/**
 * Fixture: an online shop's order API as an OpenAPI 3.1 document. Exercises list/get/create/
 * update/delete, $ref, allOf, nullable, formats, enums, an operation without a description, one
 * without an operationId, a deprecated one, a cookie parameter, an array response, and a schema
 * construct the converter does not handle.
 */
import type { OpenAPIDocument } from "../../src/openapi";

export const storeDocument: OpenAPIDocument = {
  openapi: "3.1.0",
  info: {
    title: "Northwind Outfitters API",
    description: "Orders and products for the Northwind Outfitters shop.",
    version: "2.3.0",
  },
  servers: [{ url: "https://api.northwind.example/v1" }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer" },
      partnerKey: { type: "apiKey", in: "header", name: "X-Partner-Key" },
    },
    schemas: {
      Money: {
        type: "object",
        required: ["amount", "currency"],
        properties: {
          amount: { type: "number", description: "Amount in major units" },
          currency: { type: "string", minLength: 3, maxLength: 3 },
        },
      },
      OrderBase: {
        type: "object",
        required: ["customerEmail", "items"],
        properties: {
          customerEmail: { type: "string", format: "email", description: "Who placed the order" },
          items: {
            type: "array",
            minItems: 1,
            description: "Line items",
            items: {
              type: "object",
              required: ["sku", "quantity"],
              properties: {
                sku: { type: "string", description: "Product SKU" },
                quantity: { type: "integer", minimum: 1, description: "Units ordered" },
              },
            },
          },
          note: { type: "string", nullable: true, description: "Free-text note for the packer" },
        },
      },
      Order: {
        allOf: [
          { $ref: "#/components/schemas/OrderBase" },
          {
            type: "object",
            required: ["id", "status", "total", "placedAt"],
            properties: {
              id: { type: "string", description: "Order id" },
              status: {
                type: "string",
                enum: ["pending", "paid", "shipped", "cancelled"],
                description: "Fulfilment status",
              },
              total: { $ref: "#/components/schemas/Money" },
              placedAt: { type: "string", format: "date-time" },
              trackingUrl: { type: ["string", "null"], format: "uri" },
            },
          },
        ],
      },
      OrderPatch: {
        type: "object",
        properties: {
          note: { type: "string", description: "Replace the packer note" },
          status: {
            type: "string",
            enum: ["paid", "cancelled"],
            description: "New status; only paid or cancelled can be set by the caller",
          },
        },
      },
    },
    parameters: {
      OrderId: {
        name: "id",
        in: "path",
        required: true,
        description: "The order id, e.g. ord_1042",
        schema: { type: "string" },
      },
    },
  },
  paths: {
    "/orders": {
      get: {
        operationId: "listOrders",
        summary: "List orders",
        description:
          "Returns the caller's orders, newest first, filtered by status. Pages of up to 50 with a cursor for the next page.",
        parameters: [
          {
            name: "status",
            in: "query",
            description: "Only orders in this status",
            schema: { type: "string", enum: ["pending", "paid", "shipped", "cancelled"] },
          },
          {
            name: "limit",
            in: "query",
            description: "Page size, 1 to 50",
            schema: { type: "integer", minimum: 1, maximum: 50, default: 20 },
          },
          {
            name: "tag",
            in: "query",
            description: "Only orders carrying every one of these tags",
            schema: { type: "array", items: { type: "string" } },
          },
        ],
        responses: {
          "200": {
            description: "A page of orders",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["orders"],
                  properties: {
                    orders: { type: "array", items: { $ref: "#/components/schemas/Order" } },
                    nextCursor: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        operationId: "createOrder",
        summary: "Place an order",
        description:
          "Places a new order for the signed-in customer and charges the payment method on file. Returns the created order with its id and status.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/OrderBase" } } },
        },
        responses: {
          "201": {
            description: "Created",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Order" } } },
          },
        },
      },
    },
    "/orders/{id}": {
      parameters: [{ $ref: "#/components/parameters/OrderId" }],
      get: {
        operationId: "getOrderById",
        summary: "Get an order",
        description:
          "Returns one order by id with its line items, total, status, and tracking link when shipped.",
        parameters: [
          {
            name: "X-Request-Id",
            in: "header",
            description: "Correlation id echoed back by the API",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "The order",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Order" } } },
          },
          "404": { description: "No such order" },
        },
      },
      patch: {
        operationId: "updateOrder",
        summary: "Update an order",
        description:
          "Changes the packer note or moves a pending order to paid or cancelled. Shipped orders cannot be changed.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/OrderPatch" } } },
        },
        responses: {
          "200": {
            description: "The updated order",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Order" } } },
          },
        },
      },
      delete: {
        operationId: "deleteOrder",
        summary: "Delete an order",
        description:
          "Permanently deletes a cancelled order and its history. Pending, paid, or shipped orders cannot be deleted.",
        responses: { "204": { description: "Deleted" } },
      },
    },
    "/products": {
      get: {
        operationId: "listProducts",
        summary: "List products",
        security: [],
        parameters: [
          {
            name: "q",
            in: "query",
            description: "Free-text search",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Products",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["sku", "name"],
                    properties: {
                      sku: { type: "string" },
                      name: { type: "string" },
                      price: { $ref: "#/components/schemas/Money" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/products/{sku}/reviews": {
      post: {
        summary: "Add a review",
        description:
          "Adds a review for a product the customer has bought. Reviews are published after moderation, usually within a day.",
        security: [{ partnerKey: [] }],
        parameters: [
          { name: "sku", in: "path", required: true, schema: { type: "string" } },
          { name: "session", in: "cookie", schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["rating"],
                properties: {
                  rating: { type: "integer", minimum: 1, maximum: 5, description: "1 to 5 stars" },
                  body: { type: "string", description: "The review text" },
                  attachments: { not: { type: "null" }, description: "Anything goes" },
                },
              },
            },
          },
        },
        responses: {
          "202": {
            description: "Accepted",
            content: {
              "application/json": {
                schema: { type: "object", properties: { reviewId: { type: "string" } } },
              },
            },
          },
        },
      },
    },
    "/legacy/carts": {
      get: {
        operationId: "listCarts",
        deprecated: true,
        description: "Lists carts. Replaced by orders; removed in the next major version.",
        responses: { "200": { description: "Carts" } },
      },
    },
  },
};
