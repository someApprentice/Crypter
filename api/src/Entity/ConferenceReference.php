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
     * @ORM\Column(type="integer", options={"default": 0})
     */
    private $count = 0;

    /**
     * @ORM\Column(type="integer", options={"default": 0})
     */
    private $unread = 0;

    /**
     * @ORM\ManyToOne(targetEntity="Crypter\Entity\User")
     * @ORM\JoinColumn(name="participant", referencedColumnName="uuid", nullable=true)
     */
    private $participant;
    
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

    public function getCount(): ?int
    {
        return $this->count;
    }

    public function setCount(int $count): self
    {
        $this->count = $count;

        return $this;
    }

    public function getUnread(): ?int
    {
        return $this->unread;
    }

    public function setUnread(int $unread): self
    {
        $this->unread = $unread;

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
}
