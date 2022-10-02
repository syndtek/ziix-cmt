const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const CMT = require("./CMT");

yargs(hideBin(process.argv))
  .command("dump", "create dump", () => {
    CMT.dump().then(() => {
      console.log('Dump complete')
    })
  })
  .parse();
