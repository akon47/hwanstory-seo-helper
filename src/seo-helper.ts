import xml from 'xml';
import axios from 'axios';
import { parse } from 'node-html-parser';
import { getAllPosts } from './api/blog';
import { attachmentFileBaseUrl, getHttpApiError } from './api/common/httpApiClient';
import { SliceDto } from './api/models/common.dtos';
import { SimplePostDto } from './api/models/blog.dtos';

const fs = require('fs');
const path = require('path');
const blogBaseUri = process.env.BLOG_BASE_URI;

class SeoHelper {
  private cachedPosts: Array<SimplePostDto> | null = null;

  public constructor() {
    this.cachedPosts = null;
  }

  public async createSitemap(filePath: string) {
    const posts = await this.getPosts();

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
              loc: blogBaseUri,
            },
            {
              lastmod: new Date(Math.max.apply(null, posts.map(post => new Date(post.lastModifiedAt).getTime()))).toISOString(),
            },
            {priority: '1.0'},
          ],
        },
        ...posts.reduce((urls: any, url) => {
          urls.push({
            url: [
              {
                loc: `${blogBaseUri}/${url.author.blogId}/posts/${url.postUrl}`,
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
      console.info(`Sitemap creation for a total of ${posts.length} posts has been completed.`);
    }
  }

  public async createStatics(baseDir: string) {
    const posts = await this.getPosts();

    if (!blogBaseUri)
      throw 'Invalid BlogBaseUri';

    const response = await axios.get(blogBaseUri);
    const baseContent = response.data;

    const getStaticContent = (post: SimplePostDto) => {
      const html = parse(baseContent);
      const [head] = html.getElementsByTagName('head');

      const createOrModifyMetaAttributeContent = (attributeName: string, attributeValue: string, content: string) => {
        const [element] = html.getElementsByTagName('meta').filter(x => x.attributes[attributeName] == attributeValue);
        if (element) {
          element.setAttribute('content', content);
        } else {
          head.insertAdjacentHTML('beforeend', `<meta ${attributeName}="${attributeValue}" content="${content}"/>`);
        }
      }

      const [title] = html.getElementsByTagName('title');
      title?.set_content(post.title);

      createOrModifyMetaAttributeContent('property', 'og:title', post.title);
      createOrModifyMetaAttributeContent('name', 'twitter:title', post.title);

      createOrModifyMetaAttributeContent('property', 'og:description', post.summary);
      createOrModifyMetaAttributeContent('name', 'twitter:description', post.summary);
      createOrModifyMetaAttributeContent('name', 'description', post.summary);

      if (post.thumbnailImageUrl) {
        const postThumbnailImageUrl = `${attachmentFileBaseUrl}${post.thumbnailImageUrl}`;
        createOrModifyMetaAttributeContent('property', 'og:image', postThumbnailImageUrl);
        createOrModifyMetaAttributeContent('name', 'twitter:image', postThumbnailImageUrl);
      }

      const postUrl = `${blogBaseUri}/${post.author.blogId}/posts/${post.postUrl}`;
      createOrModifyMetaAttributeContent('property', 'og:url', postUrl);

      createOrModifyMetaAttributeContent('property', 'og:type', 'article');
      createOrModifyMetaAttributeContent('name', 'twitter:card', 'summary_large_image');

      return html.toString();
    };


    for (const post of posts) {
      const staticDirPath = path.join(baseDir, post.author.blogId, 'posts');
      const staticFilePath = path.join(staticDirPath, `${post.postUrl}.html`);

      if (!fs.existsSync(staticDirPath)) {
        fs.mkdirSync(staticDirPath, {recursive: true});
      }

      fs.writeFileSync(staticFilePath, getStaticContent(post));
    }
    console.info(`Static creation for a total of ${posts.length} posts has been completed.`);
  }

  private async getPosts(): Promise<Array<SimplePostDto>> {
    if (this.cachedPosts !== null)
      return this.cachedPosts;

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

    this.cachedPosts = result;

    return result;
  }
}

module.exports = new SeoHelper();
