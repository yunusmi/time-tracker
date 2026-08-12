import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
  ) {}

  /** Includes password_hash for credential checks. */
  findByEmail(email: string): Promise<User | null> {
    return this.userModel.scope('withPassword').findOne({ where: { email } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.userModel.findByPk(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  create(data: {
    email: string;
    name: string;
    password_hash: string;
  }): Promise<User> {
    return this.userModel.create({ ...data });
  }
}
