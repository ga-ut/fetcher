# @ga-ut/fetcher

A simple and powerful fetch wrapper with interceptors.


## Installation

```bash
npm install @ga-ut/fetcher
# or
bun add @ga-ut/fetcher
# or
yarn add @ga-ut/fetcher
# or
pnpm add @ga-ut/fetcher
```

## Usage

### Basic Usage

```typescript
import { Fetcher } from '@ga-ut/fetcher';

const fetcher = new Fetcher({
  baseUrl: 'https://api.example.com',
});

interface Post {
  id: number;
  title: string;
  body: string;
}

// GET request
const post = await fetcher.get<Post>('/posts/1');

// POST request
const newPost = await fetcher.post<Post>('/posts', {
  title: 'foo',
  body: 'bar',
  userId: 1,
});
```

### Interceptors

Interceptors allow you to modify requests and responses.

#### Request Interceptor

```typescript
fetcher.addRequestInterceptor(async (request) => {
  const token = localStorage.getItem('token');
  if (token) {
    request.headers.set('Authorization', `Bearer ${token}`);
  }
  return request;
});
```

#### Response Interceptor

```typescript
fetcher.addResponseInterceptor(async ({ request, response }) => {
  if (response.status === 401) {
    // Handle unauthorized requests
    // e.g., redirect to login page
  }
  return { request, response };
});
```

### Error Handling

The `FetcherError` class is thrown when a request fails.

```typescript
import { Fetcher, FetcherError } from '@ga-ut/fetcher';

const fetcher = new Fetcher();

try {
  await fetcher.get('https://httpbin.org/status/404');
} catch (error) {
  if (error instanceof FetcherError) {
    console.error('URL:', error.url);
    console.error('Status Code:', error.statusCode);
  }
}
```

### Custom Error Handling

You can provide a custom error handler to the `Fetcher` constructor.

```typescript
class MyCustomError extends FetcherError {
  constructor(public url: string, public statusCode: number) {
    super(`Request to ${url} failed with status ${statusCode}`);
  }
}

const fetcher = new Fetcher({
  baseError: (response) => {
    return new MyCustomError(response.url, response.status);
  },
});

try {
  await fetcher.get('https://httpbin.org/status/404');
} catch (error) {
  if (error instanceof MyCustomError) {
    console.error(error.message);
  }
}
```

## API

### `new Fetcher(options?)`

Creates a new `Fetcher` instance.

- `options.baseUrl`: The base URL for all requests.
- `options.baseHeaders`: Headers to be sent with every request.
- `options.baseOptions`: Default options for every request.
- `options.baseError`: A function that returns a custom error instance.

### `fetcher.addRequestInterceptor(handler)`

Adds a request interceptor.

### `fetcher.addResponseInterceptor(handler)`

Adds a response interceptor.

### `fetcher.get<T>(url, options?)`

Sends a GET request.

### `fetcher.post<T>(url, data, options?)`

Sends a POST request.

### `fetcher.patch<T>(url, data, options?)`

Sends a PATCH request.

### `fetcher.put<T>(url, data, options?)`

Sends a PUT request.

### `fetcher.delete<T>(url, data, options?)`

Sends a DELETE request.

## License

[MIT](./LICENSE)