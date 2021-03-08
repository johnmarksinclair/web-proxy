const net = require("net");
const axios = require("axios");
const readline = require("readline");
const port = 8080;
const buffer = "    ";

// var httpReqCount = 0;
// var httpsReqCount = 0;

const server = net.createServer();

server.on("connection", (clientConnection) => {
  clientConnection.once("data", (data) => {
    let processedData = processData(data.toString());
    console.log(processedData);
    if (!isBlocked(processedData.host) || !isBlocked(processedData.url)) {
      if (processedData.https) {
        // console.log(
        //   `https request(${httpsReqCount++}): host: ${processedData.host}`
        // );
        console.log(buffer + "requested site is not blocked");
        let serverConnection = net.createConnection(
          {
            host: processedData.host,
            port: processedData.port,
          },
          () => {
            clientConnection.write("HTTP/1.1 200 OK\r\n\n");
            clientConnection.pipe(serverConnection).pipe(clientConnection);
          }
        );
      } else {
        if (processedData.url === "/" || processedData.url === "/favicon.ico") {
          clientConnection.end("http proxy server");
        } else {
          // console.log(
          //   `http request(${httpReqCount++}): url: ${processedData.url}`
          // );
          if (isCached(processedData.url)) {
            console.log(buffer + "serving cached site");
            clientConnection.write(getCachedSite(processedData.url));
            clientConnection.end();
          } else {
            let start = new Date().getTime();
            axios
              .get(processedData.url)
              .then((response) => {
                //console.log(response.data);
                let end = new Date().getTime();
                cacheTime(processedData.url, end - start);
                cacheSite(processedData.url, response.data);
                console.log(buffer + "requested site is not blocked");
                clientConnection.write(response.data);
                clientConnection.end();
              })
              .catch((error) => {
                console.log(`error: ${error}`);
              });
          }
        }
      }
    } else {
      console.log(buffer + "requested site is blocked");
      clientConnection.write("Requested Site is Blocked");
      clientConnection.end();
    }

    clientConnection.on("close", () => {
      if (processedData.host) console.log(`closed: ${processedData.host}`);
      else console.log(`closed: ${processedData.url}`);
    });
  });
});

server.listen(port, () => {
  console.log(`server listening on ${port}`);
});

const processData = (data) => {
  //console.log(`DATA START\n\n${data}DATA END`);
  let processed = [];
  if (data.includes("CONNECT")) processed["https"] = true;
  else processed["https"] = false;
  let split = "";
  if (processed.https) {
    split = data.split(` `)[1].split(`:`);
    processed["host"] = split[0];
    processed["port"] = split[1];
  } else {
    processed["url"] = data.split(" ")[1].split(" ")[0];
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
  console.log(buffer + "cache has been cleared");
};

const showCached = () => {
  console.log(cached);
};

const showStats = () => {
  console.log(
    `${buffer + bandwidthSaved} bytes and ${timeSaved} ms saved by proxy cache`
  );
};

// server.getConnections(callback)
// Asynchronously get the number of concurrent connections on the server. Works when sockets were sent to forks.
// Callback should take two arguments err and count.
