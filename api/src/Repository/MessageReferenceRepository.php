<?php

namespace Crypter\Repository;

use Crypter\Entity\MessageReference;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Symfony\Bridge\Doctrine\RegistryInterface;

/**
 * @method MessageReference|null find($id, $lockMode = null, $lockVersion = null)
 * @method MessageReference|null findOneBy(array $criteria, array $orderBy = null)
 * @method MessageReference[]    findAll()
 * @method MessageReference[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class MessageReferenceRepository extends ServiceEntityRepository
{
    public function __construct(RegistryInterface $registry)
    {
        parent::__construct($registry, MessageReference::class);
    }

    // /**
    //  * @return MessageReference[] Returns an array of MessageReference objects
    //  */
    /*
    public function findByExampleField($value)
    {
        return $this->createQueryBuilder('m')
            ->andWhere('m.exampleField = :val')
            ->setParameter('val', $value)
            ->orderBy('m.id', 'ASC')
            ->setMaxResults(10)
            ->getQuery()
            ->getResult()
        ;
    }
    */

    /*
    public function findOneBySomeField($value): ?MessageReference
    {
        return $this->createQueryBuilder('m')
            ->andWhere('m.exampleField = :val')
            ->setParameter('val', $value)
            ->getQuery()
            ->getOneOrNullResult()
        ;
    }
    */
}
