// src/services/emiService.ts
// Re-exports EMI calculation from domain layer
// The actual implementation is in domain/loan.ts for consistency with other business logic

export { calculateEmi } from '../domain/loan';
