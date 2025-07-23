import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Fetcher, FetcherError } from "./index";

const mockFetch = mock(
	(..._args: Parameters<typeof fetch>): ReturnType<typeof fetch> => {
		return Promise.reject(
			new Error("fetch has not been mocked for this test."),
		);
	},
);

global.fetch = mockFetch as unknown as typeof fetch;

const BASE_URL = "http://localhost";

describe("Fetcher", () => {
	beforeEach(() => {
		mockFetch.mockClear();
	});

	describe("Basic Methods", () => {
		test("should make a GET request and return JSON data", async () => {
			const responseData = { message: "success" };
			mockFetch.mockImplementation(() =>
				Promise.resolve(
					new Response(JSON.stringify(responseData), {
						headers: { "Content-Type": "application/json" },
					}),
				),
			);

			const fetcher = new Fetcher({ baseUrl: BASE_URL });
			const result = await fetcher.get<{ message: string }>("/test");

			expect(mockFetch).toHaveBeenCalledTimes(1);
			const request = mockFetch.mock.calls[0][0] as Request;
			expect(request.method).toBe("GET");
			expect(request.url).toBe(`${BASE_URL}/test`);
			expect(result).toEqual(responseData);
		});

		test("should make a POST request with a JSON body", async () => {
			const requestData = { name: "test" };
			const responseData = { id: 1, ...requestData };
			mockFetch.mockImplementation(() =>
				Promise.resolve(
					new Response(JSON.stringify(responseData), {
						headers: { "Content-Type": "application/json" },
					}),
				),
			);

			const fetcher = new Fetcher({
				baseUrl: BASE_URL,
				baseHeaders: { "Content-Type": "application/json" },
			});
			const result = await fetcher.post("/test", requestData);

			expect(mockFetch).toHaveBeenCalledTimes(1);
			const request = mockFetch.mock.calls[0][0] as Request;
			expect(request.method).toBe("POST");
			const body = await request.json();
			expect(body).toEqual(requestData);
			expect(result).toEqual(responseData);
		});
	});

	describe("Error Handling", () => {
		test("should throw FetcherError on non-ok response", async () => {
			mockFetch.mockImplementation(() =>
				Promise.resolve(
					new Response("Not Found", { status: 404, statusText: "Not Found" }),
				),
			);

			const fetcher = new Fetcher({ baseUrl: BASE_URL });
			const promise = fetcher.get("/not-found");

			expect(promise).rejects.toThrow(FetcherError);

			try {
				await promise;
			} catch (error) {
				expect(error).toBeInstanceOf(FetcherError);
				if (error instanceof FetcherError) {
					expect(error.statusCode).toBe(404);
					expect(error.url).toBe(`${BASE_URL}/not-found`);
				}
			}
		});

		test("should use a custom error thrower when provided", async () => {
			class CustomError extends FetcherError {
				constructor(
					public status: number,
					public url: string,
				) {
					super({ statusCode: status, url });
				}
			}
			mockFetch.mockImplementation(() =>
				Promise.resolve(new Response("Error", { status: 500 })),
			);

			const fetcher = new Fetcher({
				baseUrl: BASE_URL,
				baseError: (res, req) => new CustomError(res.status, req.url),
			});

			const promise = fetcher.get("/error");
			expect(promise).rejects.toThrow(CustomError);
		});
	});

	describe("Interceptors", () => {
		test("request interceptor should modify the request", async () => {
			mockFetch.mockImplementation(() =>
				Promise.resolve(new Response(JSON.stringify({}))),
			);
			const fetcher = new Fetcher({ baseUrl: BASE_URL });

			fetcher.addRequestInterceptor((req) => {
				req.headers.set("X-Test-Header", "interceptor-works");
				return req;
			});

			await fetcher.get("/test");

			expect(mockFetch).toHaveBeenCalledTimes(1);
			const request = mockFetch.mock.calls[0][0] as Request;
			expect(request.headers.get("X-Test-Header")).toBe("interceptor-works");
		});

		test("response interceptor should be called on success", async () => {
			const interceptorMock = mock(({ request, response }) => ({
				request,
				response,
			}));
			mockFetch.mockImplementation(() =>
				Promise.resolve(new Response(JSON.stringify({}))),
			);

			const fetcher = new Fetcher({ baseUrl: BASE_URL });
			fetcher.addResponseInterceptor(interceptorMock);

			await fetcher.get("/test");

			expect(interceptorMock).toHaveBeenCalledTimes(1);
		});
	});

	describe("Configuration", () => {
		test("should prepend baseUrl to the request URL", async () => {
			mockFetch.mockImplementation(() =>
				Promise.resolve(new Response(JSON.stringify({}))),
			);
			const fetcher = new Fetcher({ baseUrl: "https://api.example.com" });

			await fetcher.get("/users");

			expect(mockFetch).toHaveBeenCalledTimes(1);
			const request = mockFetch.mock.calls[0][0] as Request;
			expect(request.url).toBe("https://api.example.com/users");
		});

		test("should include baseHeaders in the request", async () => {
			mockFetch.mockImplementation(() =>
				Promise.resolve(new Response(JSON.stringify({}))),
			);
			const fetcher = new Fetcher({
				baseUrl: BASE_URL,
				baseHeaders: { "X-Api-Key": "secret-key" },
			});

			await fetcher.get("/test");

			expect(mockFetch).toHaveBeenCalledTimes(1);
			const request = mockFetch.mock.calls[0][0] as Request;
			expect(request.headers.get("X-Api-Key")).toBe("secret-key");
		});
	});
});
