import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateProductService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found.');
    }

    const productsData = await this.productsRepository.findAllById(products);

    productsData.forEach(product => {
      const ordered = products.find(({ id }) => product.id === id);

      if (ordered) {
        if (product.quantity === 0) {
          throw new AppError('We ran out of this product.');
        }

        if (ordered.quantity > product.quantity) {
          throw new AppError('This quantity is unavailable.');
        }
      }
    });

    if (products.length > productsData.length) {
      throw new AppError('Product not found.');
    }

    const orderProducts = productsData.map(({ id, price }) => ({
      product_id: id,
      price,
      quantity: products.find(obj => obj.id === id)?.quantity || 0,
    }));

    const order = await this.ordersRepository.create({
      customer,
      products: orderProducts,
    });

    const updatedStock = productsData.map(product => ({
      id: product.id,
      quantity:
        product.quantity -
        (products.find(({ id }) => product.id === id)?.quantity || 0),
    }));

    await this.productsRepository.updateQuantity(updatedStock);

    return order;
  }
}

export default CreateProductService;
