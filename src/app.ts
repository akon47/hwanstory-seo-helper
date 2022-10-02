import xml from 'xml';
import { getAllPosts } from './api/blog';
import { getHttpApiError } from './api/common/httpApiClient';
import { SliceDto } from './api/models/common.dtos';
import { SimplePostDto } from './api/models/blog.dtos';

const fs = require('fs');
const baseServiceUrl = 'https://blog.kimhwan.kr';

async function getPosts() {
  const result: Array<SimplePostDto> = [];

  let posts: SliceDto<SimplePostDto> | null = null;
  while (!posts || !posts.last) {
    try {
      posts = await getAllPosts(50, posts ? posts.cursorId : null);
      posts.data.forEach(post => {
        result.push(post);
      });
    } catch (error) {
      const httpApiError = getHttpApiError(error);
      console.log(httpApiError ? httpApiError.getErrorMessage() : error);
      break;
    }
  }

  return result;
}

async function createSitemap(filePath: string) {
  const posts = await getPosts();

  const sitemapObject = {
    urlset: [
      {
        _attr: {
          xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9',
        },
      },
      {
        url: [
          {
            loc: baseServiceUrl,
          },
          {
            lastmod: new Date(Math.max.apply(null, posts.map(post => new Date(post.lastModifiedAt).getTime()))).toISOString(),
          },
          { priority: '1.0' },
        ],
      },
      ...posts.reduce((urls: any, url) => {
        urls.push({
          url: [
            {
              loc: `${baseServiceUrl}/${url.blogId}/posts/${url.postUrl}`,
            },
            {
              lastmod: new Date(url.lastModifiedAt).toISOString(),
            },
          ],
        });
        return urls;
      }, []),
    ],
  };

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>${xml(sitemapObject)}`;

  if (filePath) {
    fs.writeFileSync(filePath, sitemap);
  }
}

async function run() {
  const argv = process.argv;
  for (const [index, value] of argv.entries()) {
    const nextValue = index + 1 < argv.length ? argv[index + 1] : null;

    switch (value.toLowerCase()) {
      case '-sitemap-out':
        if (nextValue) {
          await createSitemap(nextValue);
        }
        break;
    }
  }
}

run().then(() => console.log('done!'));