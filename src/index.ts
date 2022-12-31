require("dotenv").config();

const helper = require('./seo-helper.js');

async function runSeoHelper() {
  const argv = process.argv;
  for (const [index, value] of argv.entries()) {
    const nextValue = index + 1 < argv.length ? argv[index + 1] : null;

    const command = value.toLowerCase();
    switch (command) {
      case '-sitemap-out':
        if (!nextValue)
          throw `-sitemap-out: missing file operand`;
        await helper.createSitemap(nextValue);
        break;
      case '-static-out':
        if (!nextValue)
          throw `-static-out: missing directory operand`;
        await helper.createStatics(nextValue);
        break;
    }
  }
}

runSeoHelper()
  .catch(error => {
    console.error(error)
  });
