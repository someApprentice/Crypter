<?php

namespace Crypter\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * @ORM\Entity(repositoryClass="Crypter\Repository\ParticipantRepository")
 */
class Participant
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
     * @ORM\ManyToOne(targetEntity="Crypter\Entity\Conference")
     * @ORM\JoinColumn(name="conference", referencedColumnName="uuid", nullable=false)
     */
    private $conference;

    /**
     * @ORM\ManyToOne(targetEntity="Crypter\Entity\User")
     * @ORM\JoinColumn(name="`user`", referencedColumnName="uuid", nullable=false)
     */
    private $user;

    public function getUuid(): ?string
    {
        return $this->uuid;
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

    public function getUser(): ?User
    {
        return $this->user;
    }

    public function setUser(?User $user): self
    {
        $this->user = $user;

        return $this;
    }
}
