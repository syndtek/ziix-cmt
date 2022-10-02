const { join } = require("path");
const { XMLParser } = require("fast-xml-parser");
const readline = require("readline");
const { createReadStream } = require("fs");

const FsKit = require("./FsKit");
const NetKit = require("./NetKit");

class CMT {
  static dumpDirPath = join(process.cwd(), "dump");
  static catalogsDirPath = join(CMT.dumpDirPath, "catalogs");
  static dataPath = join(CMT.dumpDirPath, "release");
  static sitemapFilePath = join(CMT.dumpDirPath, "sitemap.xml");
  static releasesListFilePath = join(CMT.dumpDirPath, "releases.txt");
  static reportFilePath = join(CMT.dumpDirPath, "report.json");

  static sitemapUrl = "https://anilibria.tv/sitemap.xml";
  static perRequestDelay = 600;
  static countOfDownloadedReleases = 0;
  static availableCatalogs = new Set();

  static xmlParser = new XMLParser();

  static filterSitemap(urls) {
    return new Promise((resolve) => {
      const re = new RegExp(/https:\/\/www\.anilibria\.tv\/release\/.+$/);
      const re2 = new RegExp(
        /(https:\/\/www\.anilibria\.tv\/release\/)(.+)(.html)/
      );
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
    console.log(join(CMT.dumpDirPath, CMT.catalogsDirPath, `${catalog}.json`));

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

  static async dump() {
    // Create dump dir
    if (!(await FsKit.exist(CMT.dumpDirPath)))
      await FsKit.mkDir(CMT.dumpDirPath);

    // Create catalogs dir
    if (!(await FsKit.exist(CMT.catalogsDirPath)))
      await FsKit.mkDir(CMT.catalogsDirPath);

    if (!(await FsKit.exist(CMT.dataPath))) await FsKit.mkDir(CMT.dataPath);

    // Download sitemap.xml
    if (!(await FsKit.exist(CMT.sitemapFilePath)))
      await NetKit.wget(CMT.sitemapUrl, CMT.sitemapFilePath);

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

      /* Create release data dir */
      await FsKit.mkDir(join(CMT.dataPath, data.code));
      await FsKit.writeFilePromise(
        join(CMT.dataPath, data.code, "data.json"),
        JSON.stringify(data)
      );

      // Download poster
      await NetKit.wget(
        `https://anilibria.tv${data.posters.original.url}`,
        join(CMT.dataPath, data.code, "poster.jpg")
      );

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

    console.log(report);

    await FsKit.writeFilePromise(
      CMT.reportFilePath,
      JSON.stringify(report, "", "\t")
    );
  }
}

module.exports = CMT;
