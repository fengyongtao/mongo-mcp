# mongo-knowledge

MongoDB-based cross-IDE knowledge management MCP server.

## Installation

```bash
npx -y mongo-knowledge
```

## Configuration

Add to your IDE's MCP configuration:

```json
{
  "mcpServers": {
    "mongo-knowledge": {
      "command": "npx",
      "args": ["-y", "mongo-knowledge"],
      "env": {
        "MONGODB_URI": "mongodb://localhost:27017",
        "MONGODB_DATABASE": "mcp_knowledge",
        "MCP_USER_ID": "your-user-id"
      }
    }
  }
}
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGODB_URI` | Yes | - | MongoDB connection string |
| `MONGODB_DATABASE` | No | `mcp_knowledge` | Database name |
| `MCP_USER_ID` | No | `default` | User identifier |
| `MCP_DEVICE_ID` | No | auto-generated | Device identifier |
| `MCP_IDE_SOURCE` | No | `unknown` | IDE source identifier |
| `MCP_ENABLE_EMBEDDING` | No | `false` | Enable semantic search |

## Supported IDEs

- Cursor
- Trae
- Windsurf
- Qoder
- Any MCP-compatible IDE

## Knowledge Types

| Type | Description |
|------|-------------|
| `Memories` | User preferences, facts, history |
| `Skills` | Reusable scripts and capabilities |
| `Rules` | Coding guidelines and constraints |
| `MCPs` | MCP server configurations |
| `Experiences` | Best practices and lessons learned |
| `Commands` | Quick command templates |
| `Contexts` | Project/domain context information |
| `Workflows` | Multi-step automation workflows |

## Tools

### CRUD Operations
- `knowledge_create` - Create knowledge document
- `knowledge_read` - Read knowledge document
- `knowledge_update` - Update knowledge document
- `knowledge_delete` - Delete knowledge document
- `knowledge_list` - List knowledge documents
- `knowledge_upsert` - Create or update document
- `knowledge_stats` - Get statistics
- `knowledge_export` - Export knowledge data

### Shortcuts
- `memory_add` - Quick add memory
- `memory_search` - Search memories
- `experience_add` - Add experience
- `context_set` - Set context
- `command_add` - Add command template
- `workflow_create` - Create workflow

### Sync
- `mcp_sync` - Sync MCP configuration
- `rule_sync` - Sync rule
- `skill_sync` - Sync skill
- `get_user_info` - Get user/device info

### Auto Sync
- `auto_sync_start` - Start auto sync
- `auto_sync_stop` - Stop auto sync
- `auto_sync_status` - Get sync status
- `auto_sync_config` - Configure sync
- `auto_sync_flush` - Flush pending events

## Development

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build
npm run build

# Type check
npm run typecheck

# Lint
npm run lint
```

## License

MIT
