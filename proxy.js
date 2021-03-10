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
                  let start = new Date().getTime();
                  console.log(buffer + "serving cached site");
                  clientConnection.write(getCachedSite(processed.url));
                  let end = new Date().getTime();
                  console.log(buffer + `time taken: ${end - start} ms`);
                  clientConnection.end();
                } else {
                  let start = new Date().getTime();
                  axios
                    .get(processed.url)
                    .then((response) => {
                      cacheSite(processed.url, response.data);
                      clientConnection.write(response.data);
                      let end = new Date().getTime();
                      console.log(buffer + `time taken: ${end - start} ms`);
                      cacheTime(processed.url, end - start);
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
        console.log(buffer + `closed: ${processed.host}`);
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
      console.log(buffer + `closed: ${processed.host}`);
    });
  });
});

server.listen(port, () => {
  console.log(`server listening on ${port}`);
  // load cache from local files
});

const reqProcessor = (data) => {
  //console.log(data);
  let processed = [];
  if (data.includes("CONNECT")) processed["type"] = "https";
  else processed["type"] = "http";
  if (data.toString().includes("websocket")) processed["ws"] = true;
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
