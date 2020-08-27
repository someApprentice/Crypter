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
    protected $BATCH_SIZE;

    public function __construct(RegistryInterface $registry, $BATCH_SIZE)
    {
        parent::__construct($registry, User::class);

        $this->BATCH_SIZE = $BATCH_SIZE;
    }

    public function getConferences(User $user, \DateTime $date, int $limit = 0): array
    {
        if ($limit === 0)
            $limit = $this->BATCH_SIZE;

        $dql = '
            SELECT
                cr
            FROM Crypter\Entity\ConferenceReference cr
            WHERE cr.user = :user AND cr.updatedAt < :date
            ORDER BY cr.updatedAt DESC
        ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameters(['user' => $user->getUuid(), 'date' => $date->format('Y-m-d H:i:s.uP')]);
        $query->setMaxResults($limit);

        $conferenceReferences = $query->getResult();

        return $conferenceReferences;
    }

    public function getOldConferences(User $user, \DateTime $date, int $limit = 0): array
    {
        if ($limit === 0)
            $limit = $this->BATCH_SIZE;

        $dql = '
            SELECT
                cr
            FROM Crypter\Entity\ConferenceReference cr
            WHERE cr.user = :user AND cr.updatedAt < :date
            ORDER BY cr.updatedAt DESC
        ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameters(['user' => $user->getUuid(), 'date' => $date->format('Y-m-d H:i:s.uP')]);
        $query->setMaxResults($limit);

        $conferenceReferences = $query->getResult();

        return $conferenceReferences;
    }

    public function getNewConferences(User $user, \DateTime $date, int $limit = 0): array
    {
        if ($limit === 0)
            $limit = $this->BATCH_SIZE;

        $dql = '
            SELECT
                cr
            FROM Crypter\Entity\ConferenceReference cr
            WHERE cr.user = :user AND cr.updatedAt < :date
            ORDER BY cr.updatedAt ASC
        ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameters(['user' => $user->getUuid(), 'date' => $date->format('Y-m-d H:i:s.uP')]);
        $query->setMaxResults($limit);

        $conferenceReferences = $query->getResult();

        return $conferenceReferences;
    }

    public function getConference(string $uuid, User $user)
    {
        $dql = '
            SELECT
                cr
            FROM Crypter\Entity\ConferenceReference cr
            WHERE cr.conference = :uuid AND cr.user = :user
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
                cr
            FROM Crypter\Entity\ConferenceReference cr
            WHERE cr.user = :user AND cr.participant = :uuid
        ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameters(['uuid' => $uuid, 'user' => $user->getUuid()]);

        $conferenceReference = $query->getOneOrNullResult();

        return $conferenceReference;
    }

    /**
     * @TODO: Delete this unnecessary method
     */
    public function getMessages(User $user): array
    {
        $dql = '
            SELECT
                m
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

    public function getReadMessages(User $user, \DateTime $date): array
    {
        $dql = '
            SELECT m
            FROM Crypter\Entity\Message m
            JOIN Crypter\Entity\MessageReference mr WITH m.uuid = mr.message
            WHERE mr.user = :user AND m.readAt > :date
            ORDER BY m.date ASC
        ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameters(['user' => $user->getUuid(), 'date' => $date->format('Y-m-d H:i:s.uP')]);

        $messages = $query->getResult();

        return $messages;
    }

    public function getUpdatedConferences(User $user, \DateTime $date): array
    {
        $dql = '
            SELECT
                cr
            FROM Crypter\Entity\ConferenceReference cr
            WHERE cr.user = :user AND cr.updatedAt > :date
            ORDER BY cr.updatedAt ASC
        ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameters(['user' => $user->getUuid(), 'date' => $date->format('Y-m-d H:i:s.uP')]);

        $conferenceReferences = $query->getResult();

        return $conferenceReferences;
    }

    public function getUpdatedMessages(User $user, \DateTime $date): array
    {
        $dql = '
            SELECT
                m
            FROM Crypter\Entity\Message m
            JOIN Crypter\Entity\ConferenceReference cr WITH m.conference = cr.conference
            JOIN Crypter\Entity\MessageReference mr WITH mr.message = m.uuid
            WHERE
                m.date > :date AND
                cr.updatedAt > :date AND
                mr.user = :user
            ORDER BY m.date ASC
        ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameters(['user' => $user->getUuid(), 'date' => $date->format('Y-m-d H:i:s.uP')]);

        $messages = $query->getResult();

        return $messages;
    }

    public function getUnreadMessages(User $user, \DateTime $date): array
    {
        $dql = '
            SELECT
                m
            FROM Crypter\Entity\Message m
            JOIN Crypter\Entity\Conference c WITH m.conference = c.uuid
            JOIN Crypter\Entity\ConferenceReference cr WITH c.uuid = cr.conference
            JOIN Crypter\Entity\MessageReference mr WITH mr.message = m.uuid
            WHERE
                m.read = FALSE AND
                m.author != :user AND
                m.date > :date AND
                mr.user = :user
            ORDER BY m.date ASC
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
