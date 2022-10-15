// Build-in dependencies
const readline = require("readline");
const { join } = require("path");
const { createReadStream } = require("fs");

// External dependencies
const { XMLParser } = require("fast-xml-parser");
const { green, blue } = require("colorette")

// Inner dependencies
const FsKit = require("./FsKit");
const NetKit = require("./NetKit");

class CMT {
  // File Systems constants
  static dumpDirPath = join(process.cwd(), "dump");
  static catalogsDirPath = join(CMT.dumpDirPath, "catalogs");
  static dataPath = join(CMT.dumpDirPath, "release");
  static sitemapFilePath = join(CMT.dumpDirPath, "sitemap.xml");
  static releasesListFilePath = join(CMT.dumpDirPath, "releases.txt");
  static reportFilePath = join(CMT.dumpDirPath, "report.json");

  // Another constants
  static sitemapUrl = "https://anilibria.tv/sitemap.xml";
  static perRequestDelay = 600;

  // Variables
  static countOfDownloadedReleases = 0;
  static availableCatalogs = new Set();

  // Dependencies
  static xmlParser = new XMLParser();

  static filterSitemap(urls) {
    const re = new RegExp(/https:\/\/www\.anilibria\.tv\/release\/.+$/);
    const re2 = new RegExp(
      /(https:\/\/www\.anilibria\.tv\/release\/)(.+)(.html)/
    );

    return new Promise((resolve) => {
      const releasesUrls = [];

      urls.map(({ loc }) => {
        const matched = loc.match(re);
        if (matched) {
          releasesUrls.push(matched[0].match(re2)[2]);
        }
      });

      resolve(releasesUrls);
    });
  }

  static async addCodeToCatalog(catalog, data) {
    console.log(`Release ${blue(data.name)} added to catalog: ${green(catalog)}`);

    const catalogFilePath = join(CMT.catalogsDirPath, `${catalog}.json`);

    if (!(await FsKit.exist(catalogFilePath))) {
      await FsKit.writeFilePromise(
        catalogFilePath,
        JSON.stringify([data], "", "\t")
      );
    }

    const source = await FsKit.readFilePromise(catalogFilePath);
    await FsKit.writeFilePromise(
      catalogFilePath,
      JSON.stringify([data, ...JSON.parse(source)], "", "\t")
    );
  }

  static async saveReleaseData(data) {
    const dataPath = join(CMT.dataPath, data.code);
    await FsKit.mkDir(dataPath);
    await FsKit.writeFilePromise(
      join(dataPath, "data.json"),
      JSON.stringify(data)
    );
  }

  static async downloadReleasePosterImage(url, path) {
    await NetKit.wget(`https://anilibria.tv${url}`, join(path, "poster.jpg"));
  }

  static async dump() {
    // Create dump dir
    if (!(await FsKit.exist(CMT.dumpDirPath))) {
      await FsKit.mkDir(CMT.dumpDirPath);
      console.log(green("Dump dir created"));
    }

    // Create catalogs dir
    if (!(await FsKit.exist(CMT.catalogsDirPath))) {
      await FsKit.mkDir(CMT.catalogsDirPath);
      console.log(green("Catalogs dir created"));
    }

    if (!(await FsKit.exist(CMT.dataPath))) {
      await FsKit.mkDir(CMT.dataPath);
      console.log(green("Created releases dir"));
    }

    // Download sitemap.xml
    if (!(await FsKit.exist(CMT.sitemapFilePath))) {
      await NetKit.wget(CMT.sitemapUrl, CMT.sitemapFilePath);
      console.log(green("sitemap.xml downloaded"));
    }

    // Generate `release` file
    if (!(await FsKit.exist(CMT.releasesListFilePath))) {
      const sitemap = CMT.xmlParser.parse(
        await FsKit.readFilePromise(CMT.sitemapFilePath)
      );
      const urls = sitemap.urlset.url;

      const releasesList = await CMT.filterSitemap(urls);

      await FsKit.writeFilePromise(
        this.releasesListFilePath,
        releasesList.join("\n")
      );

      console.log(green("Releases.txt created!"));
    }

    const readInterface = readline.createInterface({
      input: createReadStream(CMT.releasesListFilePath),
      console: false,
      crlfDelay: Infinity,
    });

    function sleep(ms) {
      return new Promise((resolve) => {
        setTimeout(resolve, ms);
      });
    }

    for await (const line of readInterface) {
      const data = await NetKit.getJson(
        `https://api.anilibria.tv/v2/gettitle?code=${line}`
      );

      console.log(`Release ${green(data.id)} fetched!`);

      // Save release data to .json
      await CMT.saveReleaseData(data);
      console.log(`Release ${green(data.id)} data saved`);

      // Download poster
      await CMT.downloadReleasePosterImage(
        data.posters.original.url,
        join(CMT.dataPath, data.code)
      );

      console.log(`Release ${green(data.id)} poster downloaded`);

      // Add to type catalog
      CMT.availableCatalogs.add(data.type.string || "UNKNOWN");
      await CMT.addCodeToCatalog(data.type.string || "UNKNOWN", {
        name: data.names.ru,
        code: data.code,
      });

      // Add genre catalog
      await data.genres.map(async (genre) => {
        CMT.availableCatalogs.add(genre || "UNKNOWN_GENRE");
        await CMT.addCodeToCatalog(genre || "UNKNOWN_GENRE", {
          name: data.names.ru,
          code: data.code,
        });
      });
      CMT.countOfDownloadedReleases += 1;
      await sleep(CMT.perRequestDelay);
    }

    // Generate report file
    const report = {
      releasesInDump: CMT.countOfDownloadedReleases,
      dumpCreatedAt: Date.now(),
      availableCatalogs: Array.from(CMT.availableCatalogs),
    };

    await FsKit.writeFilePromise(
      CMT.reportFilePath,
      JSON.stringify(report, "", "\t")
    );
  }
}

module.exports = CMT;
