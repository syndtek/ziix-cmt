const { access, constants, mkdir, readFile, writeFile } = require("fs");

class FsKit {
  static exist(path) {
    return new Promise((resolve) => {
      access(path, constants.F_OK, (err) => {
        return err ? resolve(false) : resolve(true);
      });
    });
  }

  static mkDir(path) {
    return new Promise((resolve, reject) => {
      try {
        mkdir(path, () => {
          resolve(path);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  static readFilePromise(path) {
    return new Promise((resolve, reject) => {
      readFile(path, "utf-8", (error, data) => {
        if (error) reject(error);
        resolve(data.toString());
      });
    });
  }

  static writeFilePromise(path, string) {
    return new Promise((resolve, reject) => {
      writeFile(path, string, (error) => {
        if (error) reject(error);
        resolve(path);
      });
    });
  }
}

module.exports = FsKit;
