const net = require("net");
const http = require("http");
const readline = require("readline");
const { exec } = require("child_process");

const httpPort = 80;
const httpsPort = 8080;
const buffer = "    ";

var request = require("request");
var httpReqCount = 0;
var httpsReqCount = 0;

const httpsServer = net.createServer();

httpsServer.on("error", (err) => {
  console.error(`error: ${err}`);
  exec("yarn start");
});

httpsServer.on("connection", (clientConnection) => {
  clientConnection.once("data", (data) => {
    let processedData = processData(data.toString());
    //console.log(processedData);
    if (!isBlocked(processedData.host)) {
      console.log(
        `https request(${httpsReqCount++}): url: ${processedData.host}`
      );
      console.log(buffer + "requested site is not blocked");
      let serverConnection = net.createConnection(
        {
          host: processedData.host,
          port: processedData.port,
        },
        () => {
          if (isWebsocketRequest(data)) {
          } else {
            clientConnection.write("HTTP/1.1 200 OK\r\n\n");
            clientConnection.pipe(serverConnection).pipe(clientConnection);
          }
        }
      );
    } else {
      console.log(buffer + "requested site is blocked");
      //clientConnection.write("HTTP/1.1 403 FORBIDDEN\r\n\r\n");
      clientConnection.write("Requested Site is Blocked");
      clientConnection.end();
    }
  });
});

httpsServer.listen(httpsPort, () => {
  console.log(`https server listening on ${httpsPort}`);
});

const processData = (data) => {
  //console.log(data);
  let processed = [];
  let splitStr = data.split(` `)[1].split(`:`);
  processed["host"] = splitStr[0];
  processed["port"] = splitStr[1];
  return processed;
};

const httpRequestListener = (req, res) => {
  if (req.url === "/" || req.url === "/favicon.ico") {
    res.end("http proxy server");
  } else {
    console.log(`http request(${httpReqCount++}): url: ${req.url}`);
    if (!isBlocked(req.url)) {
      if (isCached(req.url)) {
        console.log(buffer + "serving cached site");
        res.write(getCachedSite(req.url));
        res.end();
      } else {
        let start = new Date().getTime();
        request(req.url, (error, response, body) => {
          if (error) return console.log(error);
          let end = new Date().getTime();
          cacheTime(req.url, end - start);
          cacheSite(req.url, body);
          console.log(buffer + "requested site is not blocked");
          res.write(body);
          res.end();
        });
      }
    } else {
      console.log(buffer + "requested site is blocked");
      res.write("Requested Site is Blocked");
      res.end();
    }
  }
};

http.createServer(httpRequestListener).listen(httpPort, () => {
  console.log(`http server listening to ${httpPort}`);
});

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
