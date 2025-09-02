import { ApiException, fromHono } from "chanfana";
import { Hono } from "hono";
import { tasksRouter } from "./endpoints/tasks/router";
import { ContentfulStatusCode } from "hono/utils/http-status";
import { DummyEndpoint } from "./endpoints/dummyEndpoint";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

app.onError((err, c) => {
  if (err instanceof ApiException) {
    // If it's a Chanfana ApiException, let Chanfana handle the response
    return c.json(
      { success: false, errors: err.buildResponse() },
      err.status as ContentfulStatusCode,
    );
  }

  console.error("Global error handler caught:", err); // Log the error if it's not known

  // For other errors, return a generic 500 response
  return c.json(
    {
      success: false,
      errors: [{ code: 7000, message: "Internal Server Error" }],
    },
    500,
  );
});

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
  schema: {
    info: {
      title: "My Awesome API",
      version: "2.0.0",
      description: "This is the documentation for my awesome API.",
    },
  },
});

// Register Tasks Sub router
openapi.route("/tasks", tasksRouter);

// Register other endpoints
openapi.post("/dummy/:slug", DummyEndpoint);

// Export the Hono app with email handler
export default {
  fetch: app.fetch,
  async email(message: any, env: Env, ctx: any) {
    // Define routing rules: maps arrays of prefixes to target email(s)
    const forwardMap: Record<string, string[]> = {
      "matthias.siml@blueits.com": ["matthias.siml", "matthias", "siml"],
      "andreas.teich@blueits.com": ["andreas.teich", "andreas", "teich"],
      "stefan.tschierschke@blueits.com": ["stefan.tschierschke", "stefan", "tschierschke"],
      "dominik.zach@blueits.com": ["dominik.zach", "dominik", "zach"],
      "janine.rechenberg@blueits.com": ["janine.rechenberg", "janine", "rechenberg"],
      "dietmar.scharf@blueits.com": ["dietmar.scharf", "dietmar", "scharf"],
      "julian.scharf@blueits.com": ["julian.scharf", "julian", "scharf"],
      "felix.scharf@blueits.com": ["felix.scharf", "felix", "scharf"],
    };

    // Auto-generate multi-forward rules from forwardMap
    const multiForwardMap: Record<string, string[]> = {};
    const prefixToEmails: Record<string, string[]> = {};
    
    // Build a map of prefixes to their target emails
    for (const [targetEmail, prefixes] of Object.entries(forwardMap)) {
      for (const prefix of prefixes) {
        if (!prefixToEmails[prefix]) {
          prefixToEmails[prefix] = [];
        }
        prefixToEmails[prefix].push(targetEmail);
      }
    }
    
    // Find prefixes that map to multiple emails and add to multiForwardMap
    for (const [prefix, emails] of Object.entries(prefixToEmails)) {
      if (emails.length > 1) {
        multiForwardMap[prefix] = emails;
      }
    }

    // Parse the from address
    const fromEmail = message.from.toLowerCase();
    const atIndex = fromEmail.indexOf('@');
    
    if (atIndex === -1) {
      // Invalid email, forward to default
      await message.forward("dietmar.scharf@blueits.com");
      return;
    }

    // Extract local part (before @) and domain
    const localPartWithSub = fromEmail.substring(0, atIndex);
    const domain = fromEmail.substring(atIndex + 1);
    
    // Split local part to handle subaddressing (e.g., user+tag)
    const plusIndex = localPartWithSub.indexOf('+');
    const localPart = plusIndex > -1 ? localPartWithSub.substring(0, plusIndex) : localPartWithSub;
    const subaddress = plusIndex > -1 ? localPartWithSub.substring(plusIndex) : '';

    // Check for multi-forward rules first
    if (localPart in multiForwardMap) {
      const targets = multiForwardMap[localPart];
      for (const target of targets) {
        let forwardAddress = target;
        // If there's a subaddress, append it to each target email
        if (subaddress) {
          const targetAtIndex = forwardAddress.indexOf('@');
          forwardAddress = forwardAddress.substring(0, targetAtIndex) + subaddress + forwardAddress.substring(targetAtIndex);
        }
        await message.forward(forwardAddress);
      }
      return;
    }

    // Try to find a single forward rule
    let targetEmail: string | undefined;
    
    // Check each target email and its associated prefixes
    for (const [target, prefixes] of Object.entries(forwardMap)) {
      if (prefixes.includes(localPart)) {
        targetEmail = target;
        
        // If there's a subaddress, append it to the target email
        if (subaddress) {
          const targetAtIndex = targetEmail.indexOf('@');
          targetEmail = targetEmail.substring(0, targetAtIndex) + subaddress + targetEmail.substring(targetAtIndex);
        }
        break;
      }
    }

    // Forward to the appropriate address
    if (targetEmail) {
      await message.forward(targetEmail);
    } else {
      await message.forward("dietmar.scharf@blueits.com"); // Default fallback
    }
  },
};
