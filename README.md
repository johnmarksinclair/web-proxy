# CSU34031 Advanced Telecommunications

## Web Proxy Server - John Sinclair - 16325734

### Task

Implement a web proxy server which fetches items from the web on behalf of a web client instead of the client fetching them directly. This allows for caching of pages and access control.

The program should be able to:

1. Respond to HTTP & HTTPS requests and display each request on a management console. It should forward the request to the web server and relay the response to the browser.
2. Handle websocket connections.
3. Dynamically block selected URLs via the management console.
4. Efficiently cache HTTP requests locally and thus save bandwidth. You must gather timing and bandwidth data to prove the efficiency of your proxy.
5. Handle multiple requests simultaneously by implementing a threaded server.

### Overview

I implemented this server in NodeJS using the net and axios modules. The net module is used to create both servers and clients, and axios is a JavaScript library for making HTTP requests from NodeJS, based on the Promise API.

The net module allows for creation of servers, this proxy server listens to port 8080 and when a new connection is made (multiple are possible per client) it awaits a data request. This request is then processed using a server method, the processed or formatted request is printed to the management console and if the requested site is not blocked it creates a connection between the client and server, if it is blocked the server sends a 403 forbidden response to the client, prints the blocked request message to the management console and terminates the client connection using the destroy() method, ensuring no more activity occurs on this socket.

When a connection is made between a client and the server, the server will process the request differently depending on the type of request.

HTTPS requests - First the connection is confirmed by sending a status 200 "OK" message and then the following data streams are piped directly from the server to the client connection and vice versa. This is because there is no need to manually handle these packets as to do so would take longer and use more server memory.

HTTP requests - WebSockets begin as a standard HTTP request and response. The client asks to open a connection and the server responds. If successful the connection is used as a WebSocket connection. WS connections are established by upgrading an HTTP request response pair, this is initiated by the client sending a HTTP request using certain headers like "Connection: Upgrade" and "Upgrade: websocket". So our servers request processor method parses incoming HTTP requests to set the "ws" field of the processed request to true if the incoming request contains the keyword "websocket".

- WebSocket requests - if a WebSocket request is detected, all subsequent data streams are piped directly from the server to the client connection and vice versa.
- Standard HTTP requests - if the request is just a standard HTTP request the server first checks whether the requested URL is cached:
  - Cached - if cached the previously cached response body is written to the client connection and the "serving cached site" message along with infomation on time and bandwidth savings is printed to the management console. The connection is then closed.
  - Uncached - if not cached the clock is started (for cache timing data) and the request is performed. When the request receives a response the clock is stopped and the body of the response and request time is stored. The body of the response is then written to the client and the connection is ended.

This proxy server facilitates simultaneous requests via multithreading, the NodeJS net module selects an available thread to handle each event as it occurs. These threads are asynchronous, allowing for multiple connections and simultaneous requests.

### Cache Efficiency

I implemented a cache using a JavaScript map, pairing a URL with the body of the response received. Since the cached response body is in the form of characters the bandwidth saved is the length of the body mulitplied by 2 (the number of bytes a char takes up).

Below is an example of the output seen on the management console when www.example.com is loaded twice, the first where a request needs to be made and the second where a cached response can be served.

```javascript
[
  type: 'http',
  ws: false,
  url: 'http://example.com/',
  host: 'example.com',
  port: '80'
]
    requested site is not blocked
    time taken: 211 ms
    closed: example.com
[
  type: 'http',
  ws: false,
  url: 'http://example.com/',
  host: 'example.com',
  port: '80'
]
    requested site is not blocked
    serving cached site
    2512 bytes saved by caching
    211 ms saved by caching
    time taken: 1 ms
    closed: example.com
```

As you can see serving the cached response is far quicker and saves bandwidth. I tested loading sites three times and recorded the results:

- example.com - 2512 bytes
  - Caching disabled: 327 ms, 225 ms, 354 ms
    - Total: 906 ms, 7536 bytes
  - Caching enabled: 331 ms, 1 ms, 1 ms
    - Total: 333 ms, 2512 bytes
  - Efficiency: 573 ms and 5,024 bytes saved
- example.org
  - Caching disabled: 194 ms, 386 ms, 338 ms
    - Total: 918 ms, 7536 bytes
  - Caching enabled: 236 ms, 1 ms, 1 ms
    - Total: 238 ms, 2512 bytes
  - Efficiency: 680 ms and 5,024 bytes saved

### Dynamic Blocking

The proxy sever supports dynamic blocking via the management console. Using the commands `/b` and `/u` in the management console the proxy admin block and unblock specified URLs or domains. Additionally the admin can use the command `/sb` to print a list of the currently blocked domains to the console.

### Installation

Requires NodeJS and yarn or npm. First run `yarn install` in the root of the cloned repository in order to add the required dependencies. `yarn start` will then start the server, listening to port 8080 (configurable). Configure your computer or browser proxy settings and the traffic will be displayed in the terminal.

### Management Commands

`/b example.com` - blocks the specified url

`/u example.com` - unblocks the specified url

`/sb` - shows a list of blocked urls in the management console

`/sc` - shows a list of the urls that are cached

`/cc` - clears the cache

`/ss` - shows the current proxy time and bandwidth savings

### Code

```javascript
yo;
```
