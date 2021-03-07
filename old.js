const http = require("http");
const https = require("https");
const fs = require("fs");
const readline = require("readline");

const httpport = 8080;
const httpsport = 443;
const buffer = "    ";

var request = require("request");
var httpReqCount = 0;
var httpsReqCount = 0;

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

const httpsRequestListener = (req, res) => {
  console.log(req.url);
  res.end("https proxy server");
  if (req.url === "/" || req.url === "/favicon.ico") {
    res.end("https proxy server");
  } else {
    console.log(`https request(${httpsReqCount++}): url: ${req.url}`);
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

const tempListner = (req, res) => {
  res.end("req url: " + req.url);
};

http.createServer(httpRequestListener).listen(httpport, () => {
  console.log(`http server listening to ${httpport}`);
});

// local cert
// const httpsoptions = {
//   key: fs.readFileSync("localhost.key"),
//   cert: fs.readFileSync("localhost.crt"),
// };
// actual cert
const httpsoptions = {
  key: fs.readFileSync("server-key.pem"),
  cert: fs.readFileSync("server-cert.pem"),
};
https.createServer(httpsoptions, httpsRequestListener).listen(httpsport, () => {
  console.log(`https server listening to ${httpsport}`);
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

// httpserver.on("connection", () => {
//   console.log("connected");
// });

// // server.on("connection", (clientToProxySocket) => {
// //   console.log(clientToProxySocket.remoteAddress + " connected");
// // });

// server.on("error", (err) => {
//   console.log("error: " + err);
// });

// server.on("close", () => {
//   console.log("disconnected");
// });

// hashmap.size() returns the # of elements in the hashmap
// hashmap.get(<key>) returns the value of the element of the given key
// hashmap.has(<key>) checks to see if the hashmap contains the key that is passed as an argument
// hashmap.set(<key>, <value>) accepts 2 arguments and creates a new element to the hashmap
// hashmap.delete(<key>) deletes the key/value pair that matches the key that is passed in as an argument
// hashmap.clear() clears all elements from the hashmap

// http
//   .get(req.url, (resp) => {
//     let body = "";
//     resp.on("data", (data) => {
//       body += data;
//     });
//     resp.on("end", () => {
//       let end = new Date().getTime();
//       cacheTime(req.url, end - start);
//       cacheSite(req.url, body);
//       console.log(buffer + "requested site is not blocked");
//       res.write(body);
//       res.end();
//     });
//   })
//   .on("error", (err) => {
//     console.log("error: " + err.message);
//   });
