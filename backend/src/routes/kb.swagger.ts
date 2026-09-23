/**
 * @swagger
 * /kb/upload:
 *   post:
 *     summary: Upload a document and ingest it into the knowledge base
 *     tags: [Knowledge base]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: PDF, text, or markdown file (max 10mb)
 *               namespace:
 *                 type: string
 *                 default: default
 *                 description: Knowledge base namespace to ingest the chunks into
 *     responses:
 *       201:
 *         description: File chunked and upserted into the vector store
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 namespace:
 *                   type: string
 *                 totalChunks:
 *                   type: integer
 *                 sources:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: No file was uploaded
 *       500:
 *         description: Loading, splitting, or ingestion failed
 */
export {};
