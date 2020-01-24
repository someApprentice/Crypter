<?php

namespace Crypter\Repository;

use Crypter\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Symfony\Bridge\Doctrine\RegistryInterface;

/**
 * @method User|null find($id, $lockMode = null, $lockVersion = null)
 * @method User|null findOneBy(array $criteria, array $orderBy = null)
 * @method User[]    findAll()
 * @method User[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class UserRepository extends ServiceEntityRepository
{
    const BATCH_SIZE = 20;

    public function __construct(RegistryInterface $registry)
    {
        parent::__construct($registry, User::class);
    }

    public function getConferences(User $user, int $limit = self::BATCH_SIZE): array
    {
        $dql = '
            SELECT
                c,
                cr.count,
                cr.unread,
                IDENTITY(cr.participant) as participant
            FROM Crypter\Entity\Conference c
            JOIN Crypter\Entity\ConferenceReference cr WITH c.uuid = cr.conference
            WHERE cr.user = :user ORDER BY c.updated DESC
        ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameters(['user' => $user->getUuid()]);
        $query->setMaxResults($limit);
        
        $conferences = $query->getResult();

        return $conferences;
    }

    public function getConference(string $uuid, User $user)
    {
        $dql = '
            SELECT
                c,
                cr.count,
                cr.unread,
                IDENTITY(cr.participant) as participant
            FROM Crypter\Entity\Conference c
            JOIN Crypter\Entity\ConferenceReference cr WITH c.uuid = cr.conference
            WHERE c.uuid = :uuid AND cr.user = :user
        ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameters(['uuid' => $uuid, 'user' => $user->getUuid()]);

        $conference = $query->getOneOrNullResult();

        return $conference;
    }

    public function getConferenceByParticipant(string $uuid, User $user)
    {
        $dql = '
            SELECT
                c,
                cr.count,
                cr.unread,
                IDENTITY(cr.participant) as participant
            FROM Crypter\Entity\Conference c
            JOIN Crypter\Entity\ConferenceReference cr WITH c.uuid = cr.conference
            WHERE cr.user = :user AND cr.participant = :uuid
        ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameters(['uuid' => $uuid, 'user' => $user->getUuid()]);

        $conference = $query->getOneOrNullResult();

        return $conference;
    }

    /**
     * @TODO: Delete this unnecessary method
     */
    public function getMessages(User $user): array
    {
        $dql = '
            SELECT
                m,
                IDENTITY(mr.conference) AS conference
            FROM Crypter\Entity\Message m
            JOIN Crypter\Entity\MessageReference mr WITH m.uuid = mr.message
            WHERE mr.user = :user
            ORDER BY m.date DESC
        ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameters(['user' => $user->getUuid()]);
        
        $messages = $query->getResult();

        return $messages;
    }

    public function getReadedMessages(User $user, \DateTime $date): array
    {
        $dql = '
            SELECT m,
            IDENTITY(mr.conference) AS conference
            FROM Crypter\Entity\Message m
            JOIN Crypter\Entity\MessageReference mr WITH m.uuid = mr.message
            WHERE mr.user = :user AND m.readedAt > :date
            ORDER BY m.date DESC
        ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameters(['user' => $user->getUuid(), 'date' => $date->format('Y-m-d H:i:s.uP')]);

        $messages = $query->getResult();

        return $messages;
    }

    public function search(string $name): array
    {
        $dql = 'SELECT u FROM Crypter\Entity\User u WHERE u.name LIKE :name';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameter('name', "%{$name}%");

        $users = $query->getResult();

        return $users;
    }
}
