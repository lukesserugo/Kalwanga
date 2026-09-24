import {
  bulkCreateItemsSchema,
  bulkUpdateStockSchema,
  createItemSchema,
  issueItemSchema,
  listIssuesQuerySchema,
  listItemsQuerySchema,
  restockItemSchema,
  returnItemSchema,
  updateItemSchema,
  type BulkCreateItemsDto,
  type BulkUpdateStockDto,
  type CreateItemDto,
  type IssueItemDto,
  type ListIssuesQueryDto,
  type ListItemsQueryDto,
  type RestockItemDto,
  type ReturnItemDto,
  type UpdateItemDto,
} from "../schemas/inventory";

export class InventoryValidation {
  static validateCreateItem(data: unknown): CreateItemDto {
    return createItemSchema.parse(data);
  }
  static validateUpdateItem(data: unknown): UpdateItemDto {
    return updateItemSchema.parse(data);
  }
  static validateIssueItem(data: unknown): IssueItemDto {
    return issueItemSchema.parse(data);
  }
  static validateReturnItem(data: unknown): ReturnItemDto {
    return returnItemSchema.parse(data);
  }
  static validateRestockItem(data: unknown): RestockItemDto {
    return restockItemSchema.parse(data);
  }
  static validateListItems(data: unknown): ListItemsQueryDto {
    return listItemsQuerySchema.parse(data);
  }
  static validateListIssues(data: unknown): ListIssuesQueryDto {
    return listIssuesQuerySchema.parse(data);
  }
  static validateBulkCreateItems(data: unknown): BulkCreateItemsDto {
    return bulkCreateItemsSchema.parse(data);
  }
  static validateBulkUpdateStock(data: unknown): BulkUpdateStockDto {
    return bulkUpdateStockSchema.parse(data);
  }
}
