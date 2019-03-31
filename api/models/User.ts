import { Model, Table, Column, DataType, AllowNull, PrimaryKey, Default, IsUUID, IsEmail, Unique, Is } from 'sequelize-typescript';

 
@Table({tableName: 'user', modelName: 'user'})
export class User extends Model<User> {
  @IsUUID(4)
  @Default(DataType.UUIDV4)
  @PrimaryKey
  @Column({
    type: DataType.UUID
  })
  uuid: string;
 
  @AllowNull(false)
  @IsEmail
  @Unique
  @Column
  email: string;

  @AllowNull(false)
  @Column
  name: string

  @AllowNull(false)
  @Is(/^\$(2[ayb]?)\$([0-9]{1,2})\$([A-Za-z0-9.\/]{53,54})$/) // is bcrypt hash
  @Column(DataType.STRING(60))
  hash: string
}