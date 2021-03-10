# CSU34031 Advanced Telecommunications

## Web Proxy Server - John Sinclair - 16325734

### Task

Implement a web proxy server which fetches items from the web on behalf of a web client instead of the client fetching them directly. This allows for caching of pages and access control.

The program should be able to:

1. Respond to HTTP & HTTPS requests and should display each request on a management console. It should forward the request to the web server and relay the response to the browser.
2. Handle websocket connections.
3. Dynamically block selected URLs via the management console.
4. Efficiently cache HTTP requests locally and thus save bandwidth. You must gather timing and bandwidth data to prove the efficiency of your proxy.
5. Handle multiple requests simultaneously by implementing a threaded server.

### Overview

I implemented this server in NodeJS using the net and axios modules. The net module is used to create both servers and clients, and axios is a JavaScript library for making HTTP requests from NodeJS, based on the Promise API.

### Cache Efficiency

Caching chars at 2 bytes each so size is body length x 2

### Installation

Requires NodeJS and yarn or npm. First run `yarn install` in the root of the cloned repository in order to add the required dependancies. `yarn start` will then start the server, listening to port 8080. Configure your computer or browser proxy settings and the traffic will be displayed in the terminal.

### Management Commands

`/b example.com` - blocks the specified url

`/u example.com` - unblocks the specified url

`/sb` - shows a list of blocked urls in the management console

`/sc` - shows a list of the urls that are cached

`/cc` - clears the cache

`/ss` - shows the current proxy time and bandwidth savings

### Code

```javascript
const net = require("net");
const axios = require("axios");
const readline = require("readline");
const port = 8080;
const buffer = "    ";
const server = net.createServer();

server.on("connection", (clientConnection) => {
  clientConnection.once("data", (data) => {
    let processed = reqProcessor(data.toString());
    console.log(processed);
    if (!isBlocked(processed.url)) {
      console.log(buffer + "requested site is not blocked");

      let serverConnection = net.createConnection(
        {
          host: processed.host,
          port: processed.port,
        },
        () => {
          if (processed.type === "https") {
            clientConnection.write("HTTP/1.1 200 OK\r\n\n");
            clientConnection.pipe(serverConnection).pipe(clientConnection);
          } else {
            if (processed.ws) {
              clientConnection.pipe(serverConnection).pipe(clientConnection);
            } else {
              if (processed.url === "/" || processed.url === "/favicon.ico") {
                clientConnection.end("http proxy server");
              } else {
                if (isCached(processed.url)) {
                  console.log(buffer + "serving cached site");
                  clientConnection.write(getCachedSite(processed.url));
                  clientConnection.end();
                } else {
                  let start = new Date().getTime();
                  axios
                    .get(processed.url)
                    .then((response) => {
                      let end = new Date().getTime();
                      cacheTime(processed.url, end - start);
                      cacheSite(processed.url, response.data);
                      clientConnection.write(response.data);
                      clientConnection.end();
                    })
                    .catch((error) => {
                      console.log(`error: ${error}`);
                    });
                }
              }
            }
          }
        }
      );
      serverConnection.on("error", (err) => {
        console.log(`error: ${err}`);
      });
      serverConnection.on("close", () => {
        console.log(`closed: ${processed.host}`);
      });
    } else {
      console.log(buffer + "requested site is blocked");
      clientConnection.write("HTTP/1.1 403 FORBIDDEN\r\n\r\n");
      clientConnection.end();
      clientConnection.destroy();
    }
    clientConnection.on("error", (err) => {
      console.log(`error: ${err}`);
    });
    clientConnection.on("close", () => {
      console.log(`closed: ${processed.host}`);
    });
  });
});

server.listen(port, () => {
  console.log(`server listening on ${port}`);
});

const reqProcessor = (data) => {
  //console.log(data);
  let processed = [];
  if (data.includes("CONNECT")) processed["type"] = "https";
  else processed["type"] = "http";
  if (
    data.toString().includes("websocket") ||
    data.toString().includes("upgrade")
  )
    processed["ws"] = true;
  else processed["ws"] = false;
  if (processed.type === "https") {
    let host = data.split("CONNECT ")[1].split(":")[0];
    processed["url"] = host;
    processed["host"] = host;
    processed["port"] = data.split(":")[1].split(" ")[0];
  } else {
    processed["url"] = data.split(" ", 2)[1];
    processed["host"] = data.split("Host: ")[1].split("\r\n")[0];
    processed["port"] = "80";
  }
  return processed;
};

const rl = readline.createInterface(process.stdin, process.stdout);

rl.on("line", (inp) => {
  if (inp.includes("/b")) block(inp.substring(3));
  else if (inp.includes("/u")) unblock(inp.substring(3));
  else if (inp.includes("/sb")) showBlocked();
  else if (inp.includes("/sc")) showCached();
  else if (inp.includes("/cc")) clearCache();
  else if (inp.includes("/ss")) showStats();
  else if (inp.length == 0) console.log(buffer + "input a command");
  else console.log(buffer + "invalid command: " + inp);
});

var blocked = [];

const block = (inp) => {
  if (!isBlocked(inp)) {
    blocked.push(inp);
    console.log(buffer + `blocked ${inp}`);
  } else {
    console.log(buffer + `${inp} is already blocked`);
  }
};

const unblock = (inp) => {
  if (isBlocked(inp)) {
    blocked = blocked.filter((ele) => {
      return ele != inp;
    });
    console.log(buffer + `unblocked ${inp}\n`);
  } else {
    console.log(buffer + `${inp} is not blocked`);
  }
};

const isBlocked = (url) => {
  var flag = false;
  if (blocked.length > 0) {
    blocked.forEach((site) => {
      if (site.includes(url) || url.includes(site)) {
        flag = true;
      }
    });
    return flag;
  } else {
    return false;
  }
};

const showBlocked = () => {
  console.log("-------------------");
  console.log("   BLOCKED SITES   ");
  console.log("-------------------");
  if (blocked.length > 0) {
    blocked.forEach((site) => {
      console.log(site);
    });
  } else {
    console.log("none");
  }
  console.log("-------------------\n");
};

var cached = new Map();
var cachedTimes = new Map();
var timeSaved = 0;
var bandwidthSaved = 0;

const cacheSite = (url, body) => {
  cached.set(url, body);
};

const cacheTime = (url, time) => {
  cachedTimes.set(url, time);
};

const getCachedSite = (url) => {
  let body = cached.get(url);
  bandwidthSaved += body.length * 2;
  console.log(buffer + `${body.length * 2} bytes saved by caching`);
  let time = cachedTimes.get(url);
  timeSaved += time;
  console.log(buffer + `${time} ms saved by caching`);
  return body;
};

const isCached = (url) => {
  if (cached.has(url)) return true;
  else return false;
};

const clearCache = () => {
  cached.clear();
  cachedTimes.clear();
  console.log(buffer + "cache has been cleared");
};

const showCached = () => {
  console.log(cached.keys());
};

const showStats = () => {
  console.log(
    `${buffer + bandwidthSaved} bytes and ${timeSaved} ms saved by proxy cache`
  );
};
```
