<?php

namespace Crypter\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * @ORM\Entity(repositoryClass="Crypter\Repository\MessageReferenceRepository")
 */
class MessageReference
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
     * @ORM\ManyToOne(targetEntity="Crypter\Entity\Message", inversedBy="messageReferences")
     * @ORM\JoinColumn(name="message", referencedColumnName="uuid", nullable=false)
     */
    private $message;

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

    public function getMessage(): ?Message
    {
        return $this->message;
    }

    public function setMessage(?Message $message): self
    {
        $this->message = $message;

        return $this;
    }
}
