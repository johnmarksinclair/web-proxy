const net = require("net");
const axios = require("axios");
const readline = require("readline");
const buffer = "    ";
// specify port to listen to
const port = 8080;
// creating the server
const server = net.createServer();

// setting the server to perform actions upon new connections
server.on("connection", (clientConnection) => {
  // when the server receives data (requests) perform operations
  clientConnection.once("data", (data) => {
    // process the raw request
    let processed = reqProcessor(data.toString());
    // display the formatted request to the management console
    console.log(processed);
    // check if the requested site is blocked
    if (!isBlocked(processed.url)) {
      console.log(buffer + "requested site is not blocked");
      // if not blocked create a connection using the server host and port info
      let serverConnection = net.createConnection(
        {
          host: processed.host,
          port: processed.port,
        },
        () => {
          // check request type
          if (processed.type === "https") {
            // perform HTTPS handshake and pipe further packets
            clientConnection.write("HTTP/1.1 200 OK\r\n\n");
            clientConnection.pipe(serverConnection).pipe(clientConnection);
          } else {
            if (processed.ws) {
              // pipe any websocket connection requests directly from client to server
              clientConnection.pipe(serverConnection).pipe(clientConnection);
            } else {
              if (processed.url === "/" || processed.url === "/favicon.ico") {
                clientConnection.end("http proxy server");
              } else {
                // check whether caches response available
                if (isCached(processed.url)) {
                  let start = new Date().getTime();
                  console.log(buffer + "serving cached site");
                  // serve the cached response to the client
                  clientConnection.write(getCachedSite(processed.url));
                  let end = new Date().getTime();
                  console.log(buffer + `time taken: ${end - start} ms`);
                  let time = cachedTimes.get(processed.url);
                  console.log(
                    buffer + `${time - (end - start)} ms saved by caching`
                  );
                  timeSaved += time - (end - start);
                  // close the client connection
                  clientConnection.end();
                } else {
                  let start = new Date().getTime();
                  // perform request for uncached request
                  axios
                    .get(processed.url)
                    .then((response) => {
                      // cache the response data and associate with url
                      cacheSite(processed.url, response.data);
                      // serve the response to the client
                      clientConnection.write(response.data);
                      let end = new Date().getTime();
                      console.log(
                        buffer +
                          `bandwidth used: ${response.data.length * 2} bytes`
                      );
                      console.log(buffer + `time taken: ${end - start} ms`);
                      // note request time for cache analysis
                      cacheTime(processed.url, end - start);
                      // close the clients connection
                      clientConnection.end();
                    })
                    .catch((error) => {
                      console.log(error);
                    });
                }
              }
            }
          }
        }
      );
      serverConnection.on("error", (err) => {
        console.log(err);
      });
      serverConnection.on("close", () => {
        console.log(buffer + `closed: ${processed.host}`);
      });
    } else {
      // if requested site is blocked
      console.log(buffer + "requested site is blocked");
      // serve error 403 to client
      clientConnection.write("HTTP/1.1 403 FORBIDDEN\r\n\r\n");
      // end and destroy the connection preventing further activity
      clientConnection.end();
      clientConnection.destroy();
    }
    clientConnection.on("error", (err) => {
      console.log(err);
    });
    clientConnection.on("close", () => {
      console.log(buffer + `closed: ${processed.host}`);
    });
  });
});

// set the server to listen to specified port
server.listen(port, () => {
  console.log(`server listening on ${port}`);
});

// request processing/ formatting method
// params: data: raw request data
// returns: formatted request array object
const reqProcessor = (data) => {
  //console.log(data);
  let processed = [];
  if (data.includes("CONNECT")) processed["type"] = "https";
  else processed["type"] = "http";
  if (data.includes("websocket")) processed["ws"] = true;
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

// init the management console input
const rl = readline.createInterface(process.stdin, process.stdout);

// check for management console commands and route accordingly
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

// array of blocked sites/ domains
var blocked = [];

// blocks specified url or domain
// params: inp: admin inputted domain or url to be blocked
const block = (inp) => {
  if (!isBlocked(inp)) {
    blocked.push(inp);
    console.log(buffer + `blocked ${inp}`);
  } else {
    console.log(buffer + `${inp} is already blocked`);
  }
};

// unblocks url or domain
// params: inp: admin inputted domain or url to be unblocked
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

// checks if specified url is blocked
// params: url: admin inputted url or domain
// returns: boolean
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

// prints list of currently blocked sites to the management console
const showBlocked = () => {
  console.log("blocked sites:");
  if (blocked.length > 0) {
    blocked.forEach((site) => {
      console.log(buffer + site);
    });
  } else {
    console.log(buffer + "none");
  }
};

var cached = new Map();
var cachedTimes = new Map();
var timeSaved = 0;
var bandwidthSaved = 0;

// caches a site
// params: url: url to be cached, body: response body for url
const cacheSite = (url, body) => {
  cached.set(url, body);
};

// records time taken to perform request
// params: url: url to cache time, time: time taken to perform request
const cacheTime = (url, time) => {
  cachedTimes.set(url, time);
};

// gets a site from the cache
// params: url: url required to serve to client
// returns: body: the body of the cached response
const getCachedSite = (url) => {
  let body = cached.get(url);
  bandwidthSaved += body.length * 2;
  console.log(buffer + `bandwidth saved: ${body.length * 2} bytes`);
  return body;
};

// checks whether a site is cached or not
// params: url: site to check if cached
// returns: boolean
const isCached = (url) => {
  if (cached.has(url)) return true;
  else return false;
};

// clears the cache
const clearCache = () => {
  cached.clear();
  cachedTimes.clear();
  console.log(buffer + "cache has been cleared");
};

// prints the currently cached site urls to the management console
const showCached = () => {
  console.log(cached.keys());
};

// prints the current time and bandwidth savings from serving cached sites
const showStats = () => {
  console.log(
    `${buffer + bandwidthSaved} bytes and ${timeSaved} ms saved by proxy cache`
  );
};
