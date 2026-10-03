export const openapiDocument = {
  openapi: "3.0.3",

  info: {
    title: "TaskFlow API",
    version: "1.0.0",
    description:
      "Multi-tenant task and project management API for the TaskFlow backend."
  },

  servers: [
    {
      url: "http://localhost:3000",
      description: "Local development server"
    },
    {
      url: "https://taskflow-backend-api-7iwy.onrender.com",
      description: "Production server"
    }
  ],

  tags: [
    { name: "Health", description: "Service health" },
    { name: "Auth", description: "Authentication and token management" },
    { name: "Projects", description: "Project management" },
    { name: "Tasks", description: "Task management" },
    { name: "Jobs", description: "Background job status" }
  ],

  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    },

    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string" },
          code: { type: "string" },
          details: {
            type: "object",
            additionalProperties: true
          }
        },
        required: ["error", "code", "details"]
      },

      RegisterRequest: {
        type: "object",
        required: [
          "email",
          "name",
          "password",
          "organizationName"
        ],
        properties: {
          email: {
            type: "string",
            format: "email"
          },
          name: {
            type: "string",
            minLength: 1
          },
          password: {
            type: "string",
            format: "password",
            minLength: 8
          },
          organizationName: {
            type: "string",
            minLength: 1,
            maxLength: 255
          }
        }
      },

      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email"
          },
          password: {
            type: "string",
            format: "password"
          }
        }
      },

      RefreshRequest: {
        type: "object",
        required: ["refreshToken"],
        properties: {
          refreshToken: {
            type: "string"
          }
        }
      },

      LogoutRequest: {
        type: "object",
        required: ["refreshToken"],
        properties: {
          refreshToken: {
            type: "string"
          }
        }
      },

      AuthUser: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid"
          },
          email: {
            type: "string",
            format: "email"
          },
          name: {
            type: "string"
          }
        },
        required: ["id", "email", "name"]
      },

      Organization: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid"
          },
          name: {
            type: "string"
          }
        },
        required: ["id", "name"]
      },

      AuthResponse: {
        type: "object",
        properties: {
          user: {
            $ref: "#/components/schemas/AuthUser"
          },
          organization: {
            $ref: "#/components/schemas/Organization"
          },
          accessToken: {
            type: "string"
          },
          refreshToken: {
            type: "string"
          },
          tokenType: {
            type: "string",
            example: "Bearer"
          },
          expiresIn: {
            type: "integer",
            example: 900
          }
        }
      },

      Project: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid"
          },
          organizationId: {
            type: "string",
            format: "uuid"
          },
          name: {
            type: "string"
          },
          description: {
            type: ["string", "null"]
          },
          createdAt: {
            type: "string",
            format: "date-time"
          },
          updatedAt: {
            type: "string",
            format: "date-time"
          }
        },
        required: [
          "id",
          "organizationId",
          "name",
          "createdAt",
          "updatedAt"
        ]
      },

      ProjectRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: {
            type: "string",
            minLength: 1
          },
          description: {
            type: "string"
          }
        }
      },

      Task: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid"
          },
          projectId: {
            type: "string",
            format: "uuid"
          },
          title: {
            type: "string"
          },
          description: {
            type: ["string", "null"]
          },
          status: {
            type: "string",
            enum: [
              "TODO",
              "IN_PROGRESS",
              "REVIEW",
              "DONE"
            ]
          },
          priority: {
            type: "string",
            enum: [
              "LOW",
              "MEDIUM",
              "HIGH",
              "URGENT"
            ]
          },
          dueDate: {
            type: ["string", "null"],
            format: "date-time"
          },
          createdAt: {
            type: "string",
            format: "date-time"
          },
          updatedAt: {
            type: "string",
            format: "date-time"
          }
        },
        required: [
          "id",
          "projectId",
          "title",
          "status",
          "priority",
          "createdAt",
          "updatedAt"
        ]
      },

      TaskRequest: {
        type: "object",
        required: [
          "projectId",
          "title",
          "status",
          "priority"
        ],
        properties: {
          projectId: {
            type: "string",
            format: "uuid"
          },
          title: {
            type: "string",
            minLength: 1
          },
          description: {
            type: "string"
          },
          status: {
            type: "string",
            enum: [
              "TODO",
              "IN_PROGRESS",
              "REVIEW",
              "DONE"
            ]
          },
          priority: {
            type: "string",
            enum: [
              "LOW",
              "MEDIUM",
              "HIGH",
              "URGENT"
            ]
          },
          dueDate: {
            type: "string",
            format: "date-time"
          }
        }
      },

      AssignmentRequest: {
        type: "object",
        required: ["userId"],
        properties: {
          userId: {
            type: "string",
            format: "uuid"
          }
        }
      },

      JobStatus: {
        type: "object",
        properties: {
          jobId: {
            type: "string"
          },
          status: {
            type: "string",
            enum: [
              "pending",
              "active",
              "completed",
              "failed"
            ]
          },
          type: {
            type: "string",
            example: "task_assigned"
          },
          createdAt: {
            type: ["string", "null"],
            format: "date-time"
          },
          finishedAt: {
            type: ["string", "null"],
            format: "date-time"
          },
          attemptsMade: {
            type: "integer"
          },
          failedReason: {
            type: ["string", "null"]
          }
        },
        required: [
          "jobId",
          "status",
          "type",
          "createdAt",
          "finishedAt",
          "attemptsMade",
          "failedReason"
        ]
      }
    }
  },

  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        responses: {
          "200": {
            description: "Service is healthy"
          },
          "503": {
            description: "Redis is unhealthy"
          }
        }
      }
    },

    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new organization and user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/RegisterRequest"
              }
            }
          }
        },
        responses: {
          "201": {
            description: "Registered successfully"
          },
          "409": {
            description: "Email already exists",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "422": {
            description: "Validation error"
          }
        }
      }
    },

    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/LoginRequest"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Login successful"
          },
          "401": {
            description: "Invalid credentials"
          },
          "422": {
            description: "Validation error"
          }
        }
      }
    },

    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Refresh access token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/RefreshRequest"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Token pair refreshed"
          },
          "401": {
            description: "Invalid, expired, or revoked refresh token"
          }
        }
      }
    },

    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/LogoutRequest"
              }
            }
          }
        },
        responses: {
          "204": {
            description: "Logout successful"
          }
        }
      }
    },

    "/projects": {
      get: {
        tags: ["Projects"],
        summary: "List projects",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Projects returned"
          }
        }
      },

      post: {
        tags: ["Projects"],
        summary: "Create project",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ProjectRequest"
              }
            }
          }
        },
        responses: {
          "201": {
            description: "Project created"
          },
          "422": {
            description: "Validation error"
          }
        }
      }
    },

    "/projects/{id}": {
      get: {
        tags: ["Projects"],
        summary: "Get project",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid"
            }
          }
        ],
        responses: {
          "200": {
            description: "Project returned"
          },
          "403": {
            description: "Cross-tenant access denied"
          },
          "404": {
            description: "Project not found"
          }
        }
      },

      patch: {
        tags: ["Projects"],
        summary: "Update project",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid"
            }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ProjectRequest"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Project updated"
          },
          "403": {
            description: "Forbidden"
          },
          "404": {
            description: "Project not found"
          }
        }
      },

      delete: {
        tags: ["Projects"],
        summary: "Delete project",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid"
            }
          }
        ],
        responses: {
          "204": {
            description: "Project deleted"
          },
          "403": {
            description: "Forbidden"
          },
          "404": {
            description: "Project not found"
          }
        }
      }
    },

    "/projects/{id}/dashboard": {
      get: {
        tags: ["Projects"],
        summary: "Get project dashboard",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid"
            }
          }
        ],
        responses: {
          "200": {
            description: "Dashboard returned"
          },
          "403": {
            description: "Forbidden"
          },
          "404": {
            description: "Project not found"
          }
        }
      }
    },

    "/tasks": {
      get: {
        tags: ["Tasks"],
        summary: "List tasks",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: {
              type: "integer",
              minimum: 1,
              default: 1
            }
          },
          {
            name: "limit",
            in: "query",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 20
            }
          },
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: [
                "TODO",
                "IN_PROGRESS",
                "REVIEW",
                "DONE"
              ]
            }
          },
          {
            name: "priority",
            in: "query",
            schema: {
              type: "string",
              enum: [
                "LOW",
                "MEDIUM",
                "HIGH",
                "URGENT"
              ]
            }
          },
          {
            name: "assignee",
            in: "query",
            schema: {
              type: "string",
              format: "uuid"
            }
          },
          {
            name: "dueFrom",
            in: "query",
            schema: {
              type: "string",
              format: "date-time"
            }
          },
          {
            name: "dueTo",
            in: "query",
            schema: {
              type: "string",
              format: "date-time"
            }
          },
          {
            name: "projectId",
            in: "query",
            schema: {
              type: "string",
              format: "uuid"
            }
          }
        ],
        responses: {
          "200": {
            description: "Tasks returned"
          },
          "422": {
            description: "Validation error"
          }
        }
      },

      post: {
        tags: ["Tasks"],
        summary: "Create task",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/TaskRequest"
              }
            }
          }
        },
        responses: {
          "201": {
            description: "Task created"
          },
          "404": {
            description: "Project not found"
          },
          "422": {
            description: "Validation error"
          }
        }
      }
    },

    "/tasks/{id}": {
      get: {
        tags: ["Tasks"],
        summary: "Get task",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid"
            }
          }
        ],
        responses: {
          "200": {
            description: "Task returned"
          },
          "403": {
            description: "Cross-tenant access denied"
          },
          "404": {
            description: "Task not found"
          }
        }
      },

      patch: {
        tags: ["Tasks"],
        summary: "Update task",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid"
            }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/TaskRequest"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Task updated"
          },
          "403": {
            description: "Forbidden"
          },
          "404": {
            description: "Task not found"
          },
          "422": {
            description: "Validation error"
          }
        }
      },

      delete: {
        tags: ["Tasks"],
        summary: "Delete task",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid"
            }
          }
        ],
        responses: {
          "204": {
            description: "Task deleted"
          },
          "403": {
            description: "Forbidden"
          },
          "404": {
            description: "Task not found"
          }
        }
      }
    },

    "/tasks/{id}/assign": {
      post: {
        tags: ["Tasks"],
        summary: "Assign user to task",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid"
            }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/AssignmentRequest"
              }
            }
          }
        },
        responses: {
          "201": {
            description: "User assigned; notification job queued"
          },
          "403": {
            description: "User is outside the organization"
          },
          "404": {
            description: "Task not found"
          },
          "409": {
            description: "User already assigned"
          },
          "422": {
            description: "Validation error"
          }
        }
      }
    },

    "/tasks/{id}/assign/{userId}": {
      delete: {
        tags: ["Tasks"],
        summary: "Unassign user from task",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid"
            }
          },
          {
            name: "userId",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid"
            }
          }
        ],
        responses: {
          "204": {
            description: "User unassigned"
          },
          "404": {
            description: "Task or assignment not found"
          }
        }
      }
    },

    "/jobs/{id}": {
      get: {
        tags: ["Jobs"],
        summary: "Get background job status",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string"
            }
          }
        ],
        responses: {
          "200": {
            description: "Job status returned",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/JobStatus"
                }
              }
            }
          },
          "403": {
            description: "Job belongs to another organization"
          },
          "404": {
            description: "Job not found"
          }
        }
      }
    }
  }
} as const;