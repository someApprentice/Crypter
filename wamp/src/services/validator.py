import cerberus

from uuid import UUID

cerberus.Validator.types_mapping['UUID'] = cerberus.TypeDefinition('UUID', (UUID), ())