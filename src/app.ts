import xml from 'xml';
import axios from 'axios';
import { HTMLElement, parse } from 'node-html-parser';
import { getAllPosts } from './api/blog';
import { getHttpApiError } from './api/common/httpApiClient';
import { SliceDto } from './api/models/common.dtos';
import { SimplePostDto } from './api/models/blog.dtos';

const fs = require('fs');
const path = require('path');
const baseServiceUrl = 'https://hwanstory.kr';
const baseApiServiceUrl = 'https://api.blog.kimhwan.kr';
const attachmentFileBaseUrl = `${baseApiServiceUrl}/v1`;

let cachedPosts: Array<SimplePostDto> | null = null;

async function getPosts(): Promise<Array<SimplePostDto>> {
  if (cachedPosts !== null)
    return cachedPosts;

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

  cachedPosts = result;

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

async function createStatics(baseDir: string) {
  const posts = await getPosts();

  const response = await axios.get(baseServiceUrl);
  const baseIndexContent = response.data;

  const getStaticContent = (post: SimplePostDto) => {
    const html = parse(baseIndexContent);

    const [title] = html.getElementsByTagName('title');
    const [openGraphTitle] = html.getElementsByTagName('meta').filter(x => x.attributes.property == 'og:title');
    const [description] = html.getElementsByTagName('meta').filter(x => x.attributes.name == 'description');
    const [openGraphDescription] = html.getElementsByTagName('meta').filter(x => x.attributes.property == 'og:description');
    const [openGraphImage] = html.getElementsByTagName('meta').filter(x => x.attributes.property == 'og:image');

    title?.set_content(post.title);
    openGraphTitle?.setAttribute('content', post.title);
    description?.setAttribute('content', post.summary);
    openGraphDescription?.setAttribute('content', post.summary);
    if (post.thumbnailImageUrl)
      openGraphImage?.setAttribute('content', `${attachmentFileBaseUrl}${post.thumbnailImageUrl}`);

    const [head] = html.getElementsByTagName('head');
    if (head) {
      head.insertAdjacentHTML('beforeend', `<meta property="og:url" content="${baseServiceUrl}/${post.blogId}/posts/${post.postUrl}"/>`);
      head.insertAdjacentHTML('beforeend', '<meta property="og:type" content="article"/>');
    }

    return html.toString();
  };


  for (const post of posts) {
    const staticDirPath = path.join(baseDir, post.blogId, 'posts');
    const staticFilePath = path.join(staticDirPath, `${post.postUrl}.html`);

    if (fs.existsSync(staticDirPath) == false) {
      fs.mkdirSync(staticDirPath, { recursive: true });
    }

    fs.writeFileSync(staticFilePath, getStaticContent(post));
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
      case '-static-out':
        if (nextValue) {
          await createStatics(nextValue);
        }
        break;
    }
  }
}

run().then(() => console.log('done!'));