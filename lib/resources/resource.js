"use strict";
var valid = require('valid');
var MethodNotAllowed = require('../errors').MethodNotAllowed;
var Chain = require('../handlers/chain');
var Custom = require('../handlers/custom');
var impls = require('../handlers/impl').impls;
var ret = require('../handlers/ret').ret;
var subpaths = require('../tools/path').subpaths;
var MethodMapper = require('./method_mapper');


var Resource = function (path, handlers) {
	// NOTE path can be RegExp-like object (having exec() method)
	this.path = path;

	if (this.path && this.path.constructor === RegExp && this.path.global) {
		throw new Error('Path RegExp must not be global');
	}

	this.handlers = {};
	for (var method in handlers) {
		var handler = this.prepareHandler(handlers[method]);
		if (handler != null) {
			this.handlers[method] = handler;
		}
	}

	if (!('options' in this.handlers)) {
		this.handlers.options = this.createDefaultOptionsHandler();
	}

	this.methodMapper = this.createMethodMapper();
};

Resource.prototype.createDefaultOptionsHandler = function () {
	var self = this;
	return this.prepareHandler([
		ret(valid.validators.any),

			impls(function (ctx) {
				if (ctx.isHttp) {
					ctx.res.setHeader('Allow', self.methodMapper.httpMethods.join(', '));
				}

				return {
					allowedMethods: self.methodMapper.methods
				};
			})
	]);
};

Resource.prototype.createMethodMapper = function () {
	return new MethodMapper(this.handlers);
};

Resource.prototype.prepareHandler = function (handlers) {
	var result;
	if (handlers == null) {
		result = null;
	}
	else if (Array.isArray(handlers)) {
		result = new Chain(this);
		for (var i = 0; i < handlers.length; i++) {
			result.add(handlers[i]);
		}
	}
	else if (handlers.constructor === Function) {
		result = new Custom(handlers);
	}
	else {
		result = handlers;
	}
	return result;
};

Resource.prototype.resolve = function (ctx) {
	var result = null;
	if (ctx.matchPath(this.path)) {
		result = this.resolveHandler(ctx);
	}
	return result;
};

Resource.prototype.resolveHandler = function (ctx) {
	var method = this.methodMapper.resolveMethod(ctx);
	var result = this.handlers[method];

	if (result == null) {
		throw new MethodNotAllowed(this.methodMapper.methods, this.methodMapper.httpMethods);
	}
	else {
		ctx.method = method;
	}

	return result;
};

Resource.res = function (path, handlers) {
	if (arguments.length == 1) {
		handlers = path;
		path = null;
	}

	return new Resource(path, handlers);
};

Resource.res.get = function (path, handlers) {
	return Resource.res(path, {
		get: handlers
	});
};

Resource.res.subpaths = function (path, handlers) {
	return Resource.res(subpaths(path), {
		get: handlers
	});
};


module.exports = Resource;
