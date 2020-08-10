<?php

namespace Crypter\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * @ORM\Entity(repositoryClass="Crypter\Repository\ConferenceRepository")
 */
class Conference
{
    const PRIVATE_TYPE = 'private';
    const PUBLIC_TYPE = 'public';
    const SECRET_TYPE = 'secret';

    /**
     * @ORM\Id()
     * @ORM\Column(type="guid")
     * @ORM\GeneratedValue(strategy="UUID")
     *
     * @Assert\Uuid()
     */
    private $uuid;

    /**
     * @ORM\Column(type="string")
     */
    private $type;

    /**
     * @ORM\Column(name="created_at", type="datetimetz")
     */
    private $createdAt;

    public function __construct()
    {
        $this->createdAt = (new \DateTime());
    }

    public function getUuid(): ?string
    {
        return $this->uuid;
    }

    public function getType(): ?string
    {
        return $this->type;
    }

    public function setType(string $type): self
    {
        if (!in_array($type, [self::PRIVATE_TYPE, self::PUBLIC_TYPE, self::SECRET_TYPE]))
            throw new \InvalidArgumentException('Invalid type');

        $this->type = $type;

        return $this;
    }

    public function getCreatedAt(): ?\DateTimeInterface
    {
        return $this->createdAt;
    }

    public function createdAt(\DateTimeInterface $createdAt): self
    {
        $this->createdAt = $createdAt;

        return $this;
    }
}
