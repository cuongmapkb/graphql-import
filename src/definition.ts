import { keyBy } from 'lodash'
import {
  DocumentNode,
  TypeDefinitionNode,
  ObjectTypeDefinitionNode,
  InputObjectTypeDefinitionNode,
  TypeNode,
  NamedTypeNode,
} from 'graphql'

const builtinTypes = ['String', 'Float', 'Int', 'Boolean', 'ID']

export interface DefinitionMap {
  [key: string]: TypeDefinitionNode
}

export function completeDefinitionPool(
  allDefinitions: TypeDefinitionNode[],
  defintionPool: TypeDefinitionNode[],
  newTypeDefinitions: TypeDefinitionNode[],
  schemaPath: string,
): TypeDefinitionNode[] {
  while (newTypeDefinitions.length > 0) {
    const schemaMap: DefinitionMap = keyBy(allDefinitions, d => d.name.value)
    const newDefinition = newTypeDefinitions.shift()

    newTypeDefinitions.push(
      ...collectNewTypeDefinitions(
        defintionPool,
        newDefinition,
        schemaMap,
        schemaPath,
      ),
    )
  }

  return defintionPool
}

function collectNewTypeDefinitions(
  definitionPool: TypeDefinitionNode[],
  newDefinition: TypeDefinitionNode,
  schemaMap: DefinitionMap,
  schemaPath: string,
): TypeDefinitionNode[] {
  let newTypeDefinitions: TypeDefinitionNode[] = []

  if (newDefinition.kind === 'InputObjectTypeDefinition') {
    newDefinition.fields.forEach(field => {
      const namedType = getNamedType(field.type)
      const typeName = namedType.name.value

      // collect missing argument input types
      if (
        !definitionPool.some(d => d.name.value === typeName) &&
        !builtinTypes.includes(typeName)
      ) {
        const argTypeMatch = schemaMap[typeName]
        if (!argTypeMatch) {
          throw new Error(
            `Field ${field.name.value}: Couldn't find type ${typeName} in ${
              schemaPath
            }.`,
          )
        }
        newTypeDefinitions.push(argTypeMatch)
      }
    })
  }

  if (newDefinition.kind === 'ObjectTypeDefinition') {
    // collect missing interfaces
    newDefinition.interfaces.forEach(int => {
      if (!definitionPool.some(d => d.name === int.name)) {
        const interfaceName = int.name.value
        const interfaceMatch = schemaMap[interfaceName]
        if (!interfaceMatch) {
          throw new Error(
            `Couldn't find interface ${interfaceName} in ${schemaPath}.`,
          )
        }
        newTypeDefinitions.push(schemaMap[int.name.value])
      }
    })

    // iterate over all fields
    newDefinition.fields.forEach(field => {
      const namedType = getNamedType(field.type)
      const typeName = namedType.name.value

      // collect missing argument input types
      field.arguments.forEach(argument => {
        const argType = getNamedType(argument.type)
        const argTypeName = argType.name.value
        if (
          !definitionPool.some(d => d.name.value === argTypeName) &&
          !builtinTypes.includes(argTypeName)
        ) {
          const argTypeMatch = schemaMap[argTypeName]
          if (!argTypeMatch) {
            throw new Error(
              `Field ${field.name.value}: Couldn't find type ${
                argTypeName
              } in ${schemaPath}.`,
            )
          }
          newTypeDefinitions.push(argTypeMatch)
        }
      })

      // collect missing field types
      if (
        !definitionPool.some(d => d.name.value === typeName) &&
        !builtinTypes.includes(typeName)
      ) {
        const schemaType = schemaMap[typeName] as ObjectTypeDefinitionNode
        if (!schemaType) {
          throw new Error(
            `Field ${field.name.value}: Couldn't find type ${typeName} in ${
              schemaPath
            }.`,
          )
        }
        newTypeDefinitions.push(schemaType)
      }
    })
  }

  return newTypeDefinitions
}

function getNamedType(type: TypeNode): NamedTypeNode {
  if (type.kind === 'NamedType') {
    return type
  } else {
    return getNamedType(type.type)
  }
}