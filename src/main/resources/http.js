var url  = require('url');
var util = require('util');
var EventEmitter = require('events').EventEmitter

var WebServer = module.exports.WebServer = function(requestListener) {
  var that   = this;
  that.proxy = vertx.createHttpServer();

  // default socket timeout value (2 minutes)
  // TODO: Actually implement timeouts
  that.timeout = 120000;

  // default limit for incoming headers
  // TODO: Actually implement limits
  that.maxHeadersCount = 1000;

  if (requestListener) {
    that.on('request', requestListener);
  }

  that.close = function(callback) {
    if (callback) { that.on('close', callback); }
    that.proxy.close(function() { 
      that.emit('close'); 
    });
  }

  // port, [hostname], [callback]
  that.listen = function() {
    callback = null;
    host = '0.0.0.0';
    port = arguments[0];
    lastArg = arguments[arguments.length - 1];

    if (typeof lastArg  == 'function') {
      callback = lastArg;
    }
    if (typeof arguments[1]  == 'string') {
      host = arguments[1];
    }

    // activate the 'listening' callback
    if (callback) { that.on('listening', callback); }

    // setup a connection handler in vert.x
    that.proxy.requestHandler( function(request) {
      that.emit('request', new IncomingMessage(request), new ServerResponse(request.response));
    });

    // listen for incoming connections
    that.proxy.listen(port, host, function() {
      that.emit('listening');
    });
  }
}

// Node.js uses IncomingMessage for both the server and the client
// That makes this class a little bulky as we check the type
// and set properties accordingly
var IncomingMessage = module.exports.IncomingMessage = function(vertxRequest) {
  var that  = this;
  var proxy = vertxRequest;

  that.headers = proxy.headers();

  // I hate this, but dynjs barfs when you check for the 
  // existence of properties that don't exist on java objects
  var ServerRequest = org.vertx.java.core.http.impl.DefaultHttpServerRequest;
  if (proxy.getClass().getName() == ServerRequest.getName()) {
    var version = proxy.getNettyRequest().getProtocolVersion();
    that.httpMajorVersion = version.majorVersion().toString();
    that.httpMinorVersion = version.minorVersion().toString();
    that.httpVersion = that.httpMajorVersion + "." + that.httpMinorVersion;
    that.url = proxy.uri;
    that.method = proxy.method;
    that.headersSent = that.headers.size() > 0;
  } else {
    that.statusCode = proxy.statusCode;
  }
}

var ServerResponse = module.exports.ServerResponse = function(vertxResponse) {
  var that  = this;
  var proxy = vertxResponse;
  that.end = proxy.end.bind(proxy);
  
  that.writeHead = function() {
    reasonPhrase = null;
    statusCode   = arguments[0];
    headers      = {};

    if (typeof arguments[1]  == 'string') {
      reasonPhrase = arguments[1];
      if (arguments[2]) {
        headers = arguments[2];
      }
    } else if (typeof arguments[1]  == 'object') {
      headers = arguments[1];
    }
    for( header in headers ) {
      that.setHeader(header, headers[header]);
    }
    if (statusCode) {
      proxy.statusCode = statusCode;
    }
    if (reasonPhrase) {
      proxy.statusMessage = reasonPhrase;
    }
  }

  that.setHeader = function(name, value) {
    java.lang.System.err.println("HEADER: " + name + ": " + value);
    proxy.putHeader(name, value);
  }
}

var ClientRequest = module.exports.ClientRequest = function(vertxRequest) {
  var that  = this;
  var proxy = vertxRequest;
  that.end  = proxy.end.bind(proxy);
}

var DefaultRequestOptions = {
  host:     'localhost',
  hostname: 'localhost',
  method:   'GET',
  path:     '/',
  port:     80
}

// Make the web server emit events
util.inherits(WebServer, EventEmitter);

module.exports.createServer = function(requestListener) {
  return new WebServer(requestListener);
}

module.exports.request = function(options, callback) {
  switch(typeof options) {
    case 'undefined':
      options = {};
      break;
    case 'string':
      options = url.parse(options);
      break;
    case 'function':
      callback = options;
      options  = {};
  }

  options.host     = options.host     || DefaultRequestOptions.host;
  options.hostname = options.hostname || DefaultRequestOptions.hostname;
  options.port     = options.port     || DefaultRequestOptions.port;
  options.method   = options.method   || DefaultRequestOptions.method;
  options.path     = options.path     || DefaultRequestOptions.path;

  var proxy = vertx.createHttpClient()
                    .setPort(options.port)
                    .setHost(options.hostname);

  var request = proxy.request(options.method, options.path, function(resp) { 
    callback(new IncomingMessage(resp));
  });
  if (options.headers) {
    for (header in options.headers) {
      request.putHeader(header, options.headers[header]);
    }
  }
  return new ClientRequest(request);
}

// TODO: Implement this
// args are [port], [host]
module.exports.createClient = function() {
  // This is deprecated. Use http.request instead
}

var STATUS_CODES = exports.STATUS_CODES = {
  100 : 'Continue',
  101 : 'Switching Protocols',
  102 : 'Processing',                 // RFC 2518, obsoleted by RFC 4918
  200 : 'OK',
  201 : 'Created',
  202 : 'Accepted',
  203 : 'Non-Authoritative Information',
  204 : 'No Content',
  205 : 'Reset Content',
  206 : 'Partial Content',
  207 : 'Multi-Status',               // RFC 4918
  300 : 'Multiple Choices',
  301 : 'Moved Permanently',
  302 : 'Moved Temporarily',
  303 : 'See Other',
  304 : 'Not Modified',
  305 : 'Use Proxy',
  307 : 'Temporary Redirect',
  400 : 'Bad Request',
  401 : 'Unauthorized',
  402 : 'Payment Required',
  403 : 'Forbidden',
  404 : 'Not Found',
  405 : 'Method Not Allowed',
  406 : 'Not Acceptable',
  407 : 'Proxy Authentication Required',
  408 : 'Request Time-out',
  409 : 'Conflict',
  410 : 'Gone',
  411 : 'Length Required',
  412 : 'Precondition Failed',
  413 : 'Request Entity Too Large',
  414 : 'Request-URI Too Large',
  415 : 'Unsupported Media Type',
  416 : 'Requested Range Not Satisfiable',
  417 : 'Expectation Failed',
  418 : 'I\'m a teapot',              // RFC 2324
  422 : 'Unprocessable Entity',       // RFC 4918
  423 : 'Locked',                     // RFC 4918
  424 : 'Failed Dependency',          // RFC 4918
  425 : 'Unordered Collection',       // RFC 4918
  426 : 'Upgrade Required',           // RFC 2817
  428 : 'Precondition Required',      // RFC 6585
  429 : 'Too Many Requests',          // RFC 6585
  431 : 'Request Header Fields Too Large',// RFC 6585
  500 : 'Internal Server Error',
  501 : 'Not Implemented',
  502 : 'Bad Gateway',
  503 : 'Service Unavailable',
  504 : 'Gateway Time-out',
  505 : 'HTTP Version not supported',
  506 : 'Variant Also Negotiates',    // RFC 2295
  507 : 'Insufficient Storage',       // RFC 4918
  509 : 'Bandwidth Limit Exceeded',
  510 : 'Not Extended',               // RFC 2774
  511 : 'Network Authentication Required' // RFC 6585
};


