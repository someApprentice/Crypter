<?php

namespace Crypter\Repository;

use Crypter\Entity\Conference;
use Crypter\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Symfony\Bridge\Doctrine\RegistryInterface;

/**
 * @method Conference|null find($id, $lockMode = null, $lockVersion = null)
 * @method Conference|null findOneBy(array $criteria, array $orderBy = null)
 * @method Conference[]    findAll()
 * @method Conference[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class ConferenceRepository extends ServiceEntityRepository
{
    protected $BATCH_SIZE;

    public function __construct(RegistryInterface $registry, $BATCH_SIZE)
    {
        parent::__construct($registry, Conference::class);

        $this->BATCH_SIZE = $BATCH_SIZE;
    }

    public function getConferenceByParticipant(User $sender, User $participant)
    {
        $dql = '
            SELECT c FROM Crypter\Entity\Conference c
            JOIN Crypter\Entity\ConferenceReference cr WITH c.uuid = cr.conference
            WHERE cr.user = :sender AND cr.participant = :participant
        ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameters(['sender' => $sender->getUuid(), 'participant' => $participant->getUuid()]);
        
        $conference = $query->getOneOrNullResult();

        return $conference;
    }

    public function getParticipants(Conference $conference): array
    {
        $dql = '
            SELECT u FROM Crypter\Entity\User u
            JOIN Crypter\Entity\Participant p WITH u.uuid = p.user
            WHERE p.conference = :conference
        ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameter('conference', $conference->getUuid());
        
        $participants = $query->getResult();

        return $participants;
    }

    public function getMessages(Conference $conference, User $user, \DateTime $date, int $limit = 0): array
    {
        if ($limit === 0)
            $limit = $this->BATCH_SIZE;

        $dql = '
            SELECT
                m
            FROM Crypter\Entity\Message m
            JOIN Crypter\Entity\MessageReference mr WITH m.uuid = mr.message
            WHERE
                m.conference = :conference
                AND mr.user = :user
                AND m.date < :date
            ORDER BY m.date DESC
        ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameters(['conference' => $conference->getUuid(), 'user' => $user->getUuid(), 'date' => $date->format('Y-m-d H:i:s.uP')]);
        $query->setMaxResults($limit);
        
        $messages = $query->getResult();

        return $messages;
    }

    public function getUnreadMessages(Conference $conference, User $user, \DateTime $date, int $limit = 0): array
    {
        if ($limit === 0)
            $limit = $this->BATCH_SIZE;

        $dql = '
            SELECT
                m
            FROM Crypter\Entity\Message m
            JOIN Crypter\Entity\MessageReference mr WITH m.uuid = mr.message
            WHERE
                m.conference = :conference
                AND mr.user = :user
                AND m.readed = FALSE
                AND m.author != :user
                AND m.date > :date
            ORDER BY m.date ASC
        ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameters(['conference' => $conference->getUuid(), 'user' => $user->getUuid(), 'date' => $date->format('Y-m-d H:i:s.uP')]);
        $query->setMaxResults($limit);

        $messages = $query->getResult();

        return $messages;
    }

    public function getOldMessages(Conference $conference, User $user, \DateTime $date, int $limit = 0)
    {
        if ($limit === 0)
            $limit = $this->BATCH_SIZE;

        $dql = '
            SELECT
                m
            FROM Crypter\Entity\Message m
            JOIN Crypter\Entity\MessageReference mr WITH m.uuid = mr.message
            WHERE
                m.conference = :conference
                AND mr.user = :user
                AND m.date < :date
            ORDER BY m.date DESC
        ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameters(['conference' => $conference->getUuid(), 'user' => $user->getUuid(), 'date' => $date->format('Y-m-d H:i:s.uP')]);
        $query->setMaxResults($limit);

        $messages = $query->getResult();

        return $messages;
    }

    public function getNewMessages(Conference $conference, User $user, \DateTime $date, int $limit = 0)
    {
        if ($limit === 0)
            $limit = $this->BATCH_SIZE;

        $dql = '
            SELECT
                m
            FROM Crypter\Entity\Message m
            JOIN Crypter\Entity\MessageReference mr WITH m.uuid = mr.message
            WHERE
                m.conference = :conference
                AND mr.user = :user
                AND m.date > :date
            ORDER BY m.date ASC
        ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameters(['conference' => $conference->getUuid(), 'user' => $user->getUuid(), 'date' => $date->format('Y-m-d H:i:s.uP')]);
        $query->setMaxResults($limit);

        $messages = $query->getResult();

        return $messages;
    }
}
