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
    const [twitterTitle] = html.getElementsByTagName('meta').filter(x => x.attributes.name == 'twitter:title');

    const [description] = html.getElementsByTagName('meta').filter(x => x.attributes.name == 'description');
    const [openGraphDescription] = html.getElementsByTagName('meta').filter(x => x.attributes.property == 'og:description');
    const [twitterDescription] = html.getElementsByTagName('meta').filter(x => x.attributes.name == 'twitter:description');

    const [openGraphImage] = html.getElementsByTagName('meta').filter(x => x.attributes.property == 'og:image');
    const [twitterImage] = html.getElementsByTagName('meta').filter(x => x.attributes.name == 'twitter:image');

    const [openGraphUrl] = html.getElementsByTagName('meta').filter(x => x.attributes.property == 'og:url');

    title?.set_content(post.title);
    openGraphTitle?.setAttribute('content', post.title);
    twitterTitle?.setAttribute('content', post.title);
    description?.setAttribute('content', post.summary);
    openGraphDescription?.setAttribute('content', post.summary);
    twitterDescription?.setAttribute('content', post.summary);
    openGraphUrl?.setAttribute('content', `${baseServiceUrl}/${post.blogId}/posts/${post.postUrl}`);
    if (post.thumbnailImageUrl) {
      openGraphImage?.setAttribute('content', `${attachmentFileBaseUrl}${post.thumbnailImageUrl}`);
      twitterImage?.setAttribute('content', `${attachmentFileBaseUrl}${post.thumbnailImageUrl}`);
    }

    const [head] = html.getElementsByTagName('head');
    if (head) {
      head.insertAdjacentHTML('beforeend', '<meta property="og:type" content="article"/>');
      head.insertAdjacentHTML('beforeend', '<meta name="twitter:card" content="summary_large_image"/>');
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