import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'secure-password';
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const signup = async (page: Page, email: string, name: string) => {
  await page.goto('/signup');
  await page.locator('#email').fill(email);
  await page.locator('#name').fill(name);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Signup', exact: true }).click();
  await expect(page).toHaveURL('/');
};

const login = async (page: Page, email: string) => {
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('button', { name: 'New Post', exact: true })).toBeVisible();
};

const logout = async (page: Page) => {
  await page.getByRole('button', { name: 'Logout', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible();
};

const createPost = async (page: Page, content: string) => {
  await page.getByRole('button', { name: 'New Post', exact: true }).click();
  await page.locator('#content').fill(content);
  await page.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(page.locator('article.post').filter({ hasText: content })).toBeVisible();
};

test('signup, login, post CRUD, profile, and ownership authorization', async ({ page }) => {
  const ownerEmail = 'owner@example.com';
  const otherEmail = 'other@example.com';

  await signup(page, ownerEmail, 'Post Owner');
  await login(page, ownerEmail);

  await page.getByRole('button', { name: 'New Post', exact: true }).click();
  await page.locator('#content').fill('Created by the complete browser workflow.');
  await page.locator('#image').setInputFiles({
    name: 'pixel.png',
    mimeType: 'image/png',
    buffer: Buffer.from(PNG_BASE64, 'base64')
  });
  await page.getByRole('button', { name: 'Accept', exact: true }).click();

  let post = page.locator('article.post').filter({
    hasText: 'Created by the complete browser workflow.'
  });
  await expect(post).toBeVisible();
  await expect(post.getByRole('img')).toBeVisible();

  await post.getByRole('link', { name: 'Post Owner', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Post Owner' })).toBeVisible();
  await expect(page.getByText('Created by the complete browser workflow.')).toBeVisible();
  await page.goto('/');

  post = page.locator('article.post').filter({
    hasText: 'Created by the complete browser workflow.'
  });
  await post.getByRole('link', { name: 'View', exact: true }).click();
  await expect(page.getByText('Created by the complete browser workflow.')).toBeVisible();
  await page.goto('/');

  post = page.locator('article.post').filter({
    hasText: 'Created by the complete browser workflow.'
  });
  await post.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('#content').fill('Updated by the complete browser workflow.');
  await page.getByRole('button', { name: 'Remove image', exact: true }).click();
  await page.getByRole('button', { name: 'Accept', exact: true }).click();

  post = page.locator('article.post').filter({
    hasText: 'Updated by the complete browser workflow.'
  });
  await expect(post).toBeVisible();
  await expect(post.getByRole('img')).toHaveCount(0);
  const postPath = await post.getByRole('link', { name: 'View', exact: true }).getAttribute('href');
  expect(postPath).toMatch(/^\/posts\/[0-9a-f]{24}$/);

  await logout(page);
  await signup(page, otherEmail, 'Other User');
  await login(page, otherEmail);

  post = page.locator('article.post').filter({
    hasText: 'Updated by the complete browser workflow.'
  });
  await expect(post).toBeVisible();
  await expect(post.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(post.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);

  const forbiddenDelete = await page.evaluate(async (path) => {
    const response = await fetch('http://127.0.0.1:8080/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: 'mutation DeletePost($id: ID!) { deletePost(id: $id) }',
        variables: { id: path.split('/').at(-1) }
      })
    });
    return response.json();
  }, postPath as string);

  expect(forbiddenDelete.errors[0]).toMatchObject({
    message: 'Not authorized to delete this post.',
    status: 403
  });

  await logout(page);
  await login(page, ownerEmail);
  post = page.locator('article.post').filter({
    hasText: 'Updated by the complete browser workflow.'
  });
  await post.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('No posts found.')).toBeVisible();
});

test('loads additional cursor pages through the infinite feed', async ({ page }) => {
  await signup(page, 'pagination@example.com', 'Pagination User');
  await login(page, 'pagination@example.com');

  for (let index = 1; index <= 11; index += 1) {
    await createPost(page, `Cursor post ${index}`);
  }

  const loadMore = page.getByRole('button', { name: 'Load more posts', exact: true });
  if (await loadMore.isVisible()) {
    await loadMore.click();
  }

  await expect(page.getByText('Cursor post 1', { exact: true })).toBeVisible();
  await expect(page.getByText('You have reached the end of the feed.')).toBeVisible();
});
