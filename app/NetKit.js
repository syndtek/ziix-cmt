const { get } = require("https");
const { createWriteStream } = require("fs");

class NetKit {
  static async wget(url, filePath) {
    return new Promise((resolve, reject) => {
      try {
        const file = createWriteStream(filePath);
        get(url, (res) => {
          res.pipe(file);
          file.on("finish", () => {
            file.close();
            resolve(filePath);
          });
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  static async getJson(url) {
    return new Promise((resolve, reject) => {
      get(url, (res) => {
        let body = "";

        res.on("data", (chunk) => (body += chunk));

        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      });
    });
  }
}

module.exports = NetKit;
