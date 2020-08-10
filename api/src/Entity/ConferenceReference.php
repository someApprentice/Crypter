<?php

namespace Crypter\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * @ORM\Entity(repositoryClass="Crypter\Repository\ConferenceReferenceRepository")
 */
class ConferenceReference
{
    /**
     * @ORM\Id()
     * @ORM\Column(type="guid")
     * @ORM\GeneratedValue(strategy="UUID")
     *
     * @Assert\Uuid()
     */
    private $uuid;

    /**
     * @ORM\ManyToOne(targetEntity="Crypter\Entity\User")
     * @ORM\JoinColumn(name="`user`", referencedColumnName="uuid", nullable=false)
     */
    private $user;

    /**
     * @ORM\ManyToOne(targetEntity="Crypter\Entity\Conference")
     * @ORM\JoinColumn(name="conference", referencedColumnName="uuid", nullable=false)
     */
    private $conference;

    /**
     * @ORM\Column(name="messages_count", type="integer", options={"default": 0})
     */
    private $messagesCount = 0;

    /**
     * @ORM\Column(name="unread_messages_count", type="integer", options={"default": 0})
     */
    private $unreadMessagesCount = 0;

    /**
     * @ORM\ManyToOne(targetEntity="Crypter\Entity\User")
     * @ORM\JoinColumn(name="participant", referencedColumnName="uuid", nullable=true)
     */
    private $participant;

    /**
     * @ORM\Column(name="updated_at", type="datetimetz")
     */
    private $updatedAt;

    /**
     * @ORM\ManyToOne(targetEntity="Crypter\Entity\Message")
     * @ORM\JoinColumn(name="last_message", referencedColumnName="uuid", nullable=false)
     */
    private $lastMessage;
    
    public function __construct()
    {
        $this->updatedAt = (new \DateTime());
    }

    public function getUuid(): ?string
    {
        return $this->uuid;
    }

    public function getUser(): ?User
    {
        return $this->user;
    }

    public function setUser(?User $user): self
    {
        $this->user = $user;

        return $this;
    }

    public function getConference(): ?Conference
    {
        return $this->conference;
    }

    public function setConference(?Conference $conference): self
    {
        $this->conference = $conference;

        return $this;
    }

    public function getMessagesCount(): ?int
    {
        return $this->messagesCount;
    }

    public function setMessagesCount(int $messagesCount): self
    {
        $this->messagesCount = $messagesCount;

        return $this;
    }

    public function getUnreadMessagesCount(): ?int
    {
        return $this->unreadMessagesCount;
    }

    public function setUnreadMessagesCount(int $unreadMessagesCount): self
    {
        $this->unreadMessagesCount = $unreadMessagesCount;

        return $this;
    }

    public function getParticipant(): ?User
    {
        return $this->participant;
    }

    public function setParticipant(?User $participant): self
    {
        $this->participant = $participant;

        return $this;
    }

    public function getUpdatedAt(): ?\DateTimeInterface
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(\DateTimeInterface $updatedAt): self
    {
        $this->updatedAt = $updatedAt;

        return $this;
    }

    public function getLastMessage(): ?Message
    {
        return $this->lastMessage;
    }

    public function setLastMessage(?Message $lastMessage): self
    {
        $this->lastMessage = $lastMessage;

        return $this;
    }
}
