import { createAnalysisGetHandler, createAnalysisPostHandler } from "./handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createAnalysisGetHandler();
export const POST = createAnalysisPostHandler();
