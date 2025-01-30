import { RerankedDocumentIndex } from '../types';
import { RerankingModelUsage } from '../types/usage';

/**
The result of an `rerank` call.
It contains the documents, the reranked indices, and additional information.
 */
export interface RerankResult<VALUE> {
  /**
  The documents that were reranked.
     */
  readonly documents: Array<VALUE>;

  /**
  The reranked indices.
    */
  readonly rerankedIndices: Array<RerankedDocumentIndex>;

  /**
   * The reranked documents.
   * Only available if `returnDocuments` was set to `true`.
   * The order of the documents is the same as the order of the indices.
   */
  readonly rerankedDocuments?: Array<VALUE>;

  /**
  The reranking token usage.
    */
  readonly usage: RerankingModelUsage;

  /**
  Optional raw response data.
     */
  readonly rawResponse?: {
    /**
  Response headers.
       */
    headers?: Record<string, string>;
  };
}
