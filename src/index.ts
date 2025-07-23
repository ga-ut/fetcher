type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
type Options = Omit<RequestInit, "method" | "body">;
type ActionParams = Options & { method: Method; body?: object };
type InterceptorHandler<T> = (param: T) => T | Promise<T>;
type BaseHeaders = { [key: string]: string };

export class FetcherError extends Error {
	url: string;
	statusCode: number;

	constructor({ url, statusCode }: { url: string; statusCode: number }) {
		super();
		this.url = url;
		this.statusCode = statusCode;
	}
}

export class Fetcher {
	private requestInterceptors: InterceptorHandler<Request>[] = [];
	private responseInterceptors: InterceptorHandler<{
		request: Request;
		response: Response;
	}>[] = [];
	private baseUrl: string = "";
	private baseHeaders: BaseHeaders = {};
	private baseOptions: Options = {};
	private baseThrower: (response: Response, request: Request) => FetcherError =
		(response, request) => {
			const { status: statusCode } = response;
			return new FetcherError({
				url: request.url,
				statusCode,
			});
		};

	constructor(options?: {
		baseUrl?: string;
		baseHeaders?: BaseHeaders;
		baseOptions?: Options;
		baseError?: (response: Response, request: Request) => FetcherError;
	}) {
		const { baseUrl, baseHeaders, baseOptions, baseError } = options ?? {};

		if (baseUrl) {
			this.baseUrl = baseUrl;
		}

		if (baseHeaders) {
			this.baseHeaders = baseHeaders;
		}

		if (baseOptions) {
			this.baseOptions = baseOptions;
		}

		if (baseError) {
			this.baseThrower = baseError;
		}
	}

	addRequestInterceptor(handler: InterceptorHandler<Request>) {
		this.requestInterceptors.push(handler);
	}

	addResponseInterceptor(
		handler: InterceptorHandler<{ request: Request; response: Response }>,
	) {
		this.responseInterceptors.push(handler);
	}

	get<T>(url: string, options?: Options) {
		return this.action<T>(url, {
			method: "GET",
			...options,
		});
	}

	post<T>(url: string, data: object, options?: Options) {
		return this.action<T>(url, {
			method: "POST",
			body: data,
			...options,
		});
	}

	patch<T>(url: string, data: object, options?: Options) {
		return this.action<T>(url, {
			method: "PATCH",
			body: data,
			...options,
		});
	}

	put<T>(url: string, data: object, options?: Options) {
		return this.action<T>(url, {
			method: "PUT",
			body: data,
			...options,
		});
	}

	delete<T>(url: string, data: object, options?: Options) {
		return this.action<T>(url, {
			method: "DELETE",
			body: data,
			...options,
		});
	}

	private async action<T>(url: string, params: ActionParams): Promise<T> {
		const { body, method, ...rest } = params;
		const isFormData =
			typeof FormData !== "undefined" && body instanceof FormData;

		const headers = {
			...this.baseHeaders,
			...rest.headers,
		} as Record<string, string>;

		const options = {
			...this.baseOptions,
			...rest,
		};

		if (isFormData) {
			delete headers["Content-Type"];
		}

		const normalizedUrl = this.normalizeUrl(`${this.baseUrl}${url}`);
		const rawRequest = new Request(normalizedUrl, {
			...options,
			method,
			headers,
			body:
				headers["Content-Type"] === "application/json"
					? JSON.stringify(body)
					: (body as BodyInit),
		});

		const request = await this.requestHandler(rawRequest);

		const reqClone = request.clone();

		const response = await this.responseHandler({
			response: fetch(request),
			request: reqClone,
		});

		if (!response.ok) {
			throw this.baseThrower(response, reqClone);
		}

		const disposition = response.headers.get("Content-Disposition");
		const contentType = response.headers.get("Content-Type");

		if (disposition?.includes("attachment"))
			return (await response.blob()) as T;
		if (contentType?.includes("text/")) return (await response.text()) as T;
		if (
			contentType?.includes("image/") ||
			contentType?.includes("audio/") ||
			contentType?.includes("video/") ||
			contentType?.includes("application/vnd") ||
			contentType === "application/octet-stream" ||
			contentType === "application/zip"
		)
			return (await response.blob()) as T;

		return (await response.json()) as T;
	}

	private async requestHandler(request: Request): Promise<Request> {
		let result = request;

		for (const interceptor of this.requestInterceptors) {
			result = await interceptor(result);
		}

		return result;
	}

	private async responseHandler({
		response,
		request,
	}: {
		response: Promise<Response>;
		request: Request;
	}) {
		const newResponse = await response;

		let ctx = { request, response: newResponse };

		for (const interceptor of this.responseInterceptors) {
			ctx = await interceptor(ctx);
		}

		return ctx.response;
	}

	private normalizeUrl(url: string) {
		const result = url.trim();

		if (result.startsWith("http") || result.startsWith("https")) {
			return result;
		}

		if (result[0] !== "/") {
			return `/${result}`;
		}

		return result;
	}
}
