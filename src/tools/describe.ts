import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { SalesforceField, SalesforceDescribeResponse } from "../types/salesforce.js";
import { validateIdentifier } from "../utils/sanitize.js";

export const DESCRIBE_OBJECT: Tool = {
  name: "salesforce_describe_object",
  description: "Get detailed schema metadata including fields, relationships, and field properties of any Salesforce object. Examples: 'Account' shows all Account fields including custom fields; 'Case' shows all Case fields including relationships to Account, Contact etc. Results are cached for 10 minutes per object to reduce repeat API calls — use forceRefresh if you've just changed the schema and need current data. Use the optional fields parameter to return only specific fields instead of the full object (recommended for large objects like Account or Opportunity).",
  inputSchema: {
    type: "object",
    properties: {
      objectName: {
        type: "string",
        description: "API name of the object (e.g., 'Account', 'Contact', 'Custom_Object__c')"
      },
      fields: {
        type: "array",
        items: { type: "string" },
        description: "Optional. Return only these fields instead of the full object schema. Useful for large objects where you only need a few fields' details."
      },
      forceRefresh: {
        type: "boolean",
        description: "Optional. Skip the cache and fetch fresh metadata from Salesforce, overwriting any cached copy. Use after changing schema (e.g., adding a field) mid-session. Default: false."
      }
    },
    required: ["objectName"]
  }
};

export interface DescribeObjectArgs {
  objectName: string;
  fields?: string[];
  forceRefresh?: boolean;
}

// Describe results change rarely within a session, so we cache the full
// describe response per object and only re-fetch when the cache expires
// or the caller explicitly requests a refresh.
const DESCRIBE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const describeCache = new Map<string, { describe: SalesforceDescribeResponse; expiry: number }>();

export function clearDescribeCache(): void {
  describeCache.clear();
}

async function getDescribe(conn: any, objectName: string, forceRefresh: boolean): Promise<{ describe: SalesforceDescribeResponse; fromCache: boolean }> {
  const cached = describeCache.get(objectName);
  if (!forceRefresh && cached && Date.now() < cached.expiry) {
    return { describe: cached.describe, fromCache: true };
  }

  const describe = await conn.describe(objectName) as SalesforceDescribeResponse;
  describeCache.set(objectName, { describe, expiry: Date.now() + DESCRIBE_CACHE_TTL });
  return { describe, fromCache: false };
}

function formatField(field: SalesforceField): string {
  return `  - ${field.name} (${field.label})
    Type: ${field.type}${field.length ? `, Length: ${field.length}` : ''}
    Required: ${!field.nillable}
    ${field.referenceTo && field.referenceTo.length > 0 ? `References: ${field.referenceTo.join(', ')}` : ''}
    ${field.picklistValues && field.picklistValues.length > 0 ? `Picklist Values: ${field.picklistValues.map((v: { value: string }) => v.value).join(', ')}` : ''}`;
}

export async function handleDescribeObject(conn: any, args: DescribeObjectArgs) {
  const { objectName, fields: fieldFilter, forceRefresh = false } = args;

  const objValidation = validateIdentifier(objectName);
  if (!objValidation.valid) {
    return {
      content: [{ type: "text", text: objValidation.error! }],
      isError: true,
    };
  }

  try {
    const { describe, fromCache } = await getDescribe(conn, objectName, forceRefresh);

    let fieldsToShow = describe.fields;
    let missingFields: string[] = [];

    if (fieldFilter && fieldFilter.length > 0) {
      const wanted = new Set(fieldFilter.map(f => f.toLowerCase()));
      fieldsToShow = describe.fields.filter((f: SalesforceField) => wanted.has(f.name.toLowerCase()));
      const foundNames = new Set(fieldsToShow.map((f: SalesforceField) => f.name.toLowerCase()));
      missingFields = fieldFilter.filter(f => !foundNames.has(f.toLowerCase()));
    }

    const cacheNote = fromCache ? ' (from cache)' : ' (freshly fetched, now cached for 10 min)';

    let formattedDescription = `
Object: ${describe.name} (${describe.label})${describe.custom ? ' (Custom Object)' : ''}${cacheNote}
Fields${fieldFilter ? ` (${fieldsToShow.length} of ${describe.fields.length} requested)` : ` (${fieldsToShow.length} total)`}:
${fieldsToShow.map(formatField).join('\n')}`;

    if (missingFields.length > 0) {
      formattedDescription += `\n\nNote: The following requested fields were not found on ${objectName}: ${missingFields.join(', ')}`;
    }

    return {
      content: [{
        type: "text",
        text: formattedDescription
      }],
      isError: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: "text",
        text: `Error describing object "${objectName}": ${errorMessage}`
      }],
      isError: true,
    };
  }
}