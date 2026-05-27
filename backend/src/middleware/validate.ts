import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const processInvoiceSchema = Joi.object({
  amount: Joi.number().positive().max(1_000_000_000).allow('', null).messages({
    'number.base': 'Amount must be a number',
    'number.positive': 'Amount must be positive',
    'number.max': 'Amount cannot exceed $1B',
  }),
  dueDays: Joi.number().integer().min(1).max(365).default(30).messages({
    'number.base': 'Due days must be a number',
    'number.integer': 'Due days must be a whole number',
    'number.min': 'Due days must be at least 1',
    'number.max': 'Due days cannot exceed 365',
  }),
});

export function validate(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      const details = error.details.map((d) => d.message);
      res.status(400).json({ error: 'Validation failed', details });
      return;
    }
    req.body = { ...req.body, ...value };
    next();
  };
}
