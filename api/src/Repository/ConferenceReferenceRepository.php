<?php

namespace Crypter\Repository;

use Crypter\Entity\ConferenceReference;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Symfony\Bridge\Doctrine\RegistryInterface;

use Crypter\Entity\Conference;
use Crypter\Entity\User;

/**
 * @method ConferenceReference|null find($id, $lockMode = null, $lockVersion = null)
 * @method ConferenceReference|null findOneBy(array $criteria, array $orderBy = null)
 * @method ConferenceReference[]    findAll()
 * @method ConferenceReference[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class ConferenceReferenceRepository extends ServiceEntityRepository
{
    public function __construct(RegistryInterface $registry)
    {
        parent::__construct($registry, ConferenceReference::class);
    }

    public function getConferenceByParticipant(string $uuid, User $user)
    {
        $dql = '
            SELECT
                cr
            FROM Crypter\Entity\ConferenceReference cr
            JOIN Crypter\Entity\Conference c WITH c.uuid = cr.conference 
            WHERE
                c.type = :type AND
                cr.user = :user AND
                cr.participant = :uuid
        ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameters(['uuid' => $uuid, 'user' => $user->getUuid(), 'type' => 'private']);

        $conferenceReference = $query->getOneOrNullResult();

        return $conferenceReference;
    }

    public function getSecretConferenceByParticipant(string $uuid, User $user)
    {
        $dql = '
            SELECT
                cr
            FROM Crypter\Entity\ConferenceReference cr
            JOIN Crypter\Entity\Conference c WITH c.uuid = cr.conference 
            WHERE
                c.type = :type AND
                cr.user = :user AND
                cr.participant = :uuid
        ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameters(['uuid' => $uuid, 'user' => $user->getUuid(), 'type' => 'secret']);

        $conferenceReference = $query->getOneOrNullResult();

        return $conferenceReference;
    }
}
