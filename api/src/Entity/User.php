<?php

namespace Crypter\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Security\Core\User\UserInterface;

/**
 * @ORM\Entity(repositoryClass="Crypter\Repository\UserRepository")
 * @Orm\Table("`user`")
 */
class User implements UserInterface
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
     * @ORM\Column(type="string", length=255)
     *
     * @Assert\NotBlank
     * @Assert\Email
     */
    private $email;

    /**
     * @ORM\Column(type="string", length=255)
     *
     * @Assert\NotBlank
     * @Assert\Type("string")
     * @Assert\Length(min = 1, max = 255)
     */
    private $name;

    /**
     * @var string The hashed password
     * @ORM\Column(name="hash", type="string")
     *
     * @Assert\NotBlank
     * @Assert\Type("string")
     * @Assert\Length(min = 6)
     */
    private $password;

    /**
     * @ORM\Column(name="last_seen", type="datetimetz")
     */
    private $lastSeen;

    /**
     * @ORM\Column(name="conferences_count", type="integer", options={"default": 0})
     */
    private $conferencesCount = 0;

    /**
     * @ORM\Column(name="public_key", type="text")
     *
     * @Assert\NotBlank
     * @Assert\Type("string")
     */
    private $publicKey;

    /**
     * @ORM\Column(name="private_key", type="text")
     *
     * @Assert\NotBlank
     * @Assert\Type("string")
     */
    private $privateKey;

    /**
     * @ORM\Column(name="revocation_certificate", type="text")
     *
     * @Assert\NotBlank
     * @Assert\Type("string")
     */
    private $revocationCertificate;

    public function __construct()
    {
        $this->lastSeen = (new \DateTime());
    }

    public function getUuid(): ?string
    {
        return $this->uuid;
    }

    public function getEmail(): ?string
    {
        return $this->email;
    }

    public function setEmail(string $email): self
    {
        $this->email = $email;

        return $this;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setName(string $name): self
    {
        $this->name = $name;

        return $this;
    }

    /**
     * A visual identifier that represents this user.
     *
     * @see UserInterface
     */
    public function getUsername(): string
    {
        return (string) $this->uuid;
    }

    /**
     * @see UserInterface
     */
    public function getRoles(): array
    {
        // guarantee every user at least has ROLE_USER
        $roles[] = 'ROLE_USER';

        return array_unique($roles);
    }

    // public function setRoles(array $roles): self
    // {
    //     $this->roles = $roles;

    //     return $this;
    // }

    /**
     * @see UserInterface
     */
    public function getPassword(): string
    {
        return (string) $this->password;
    }

    public function setPassword(string $password): self
    {
        $this->password = $password;

        return $this;
    }

    /**
     * @see UserInterface
     */
    public function getSalt()
    {
        // not needed when using the "bcrypt" algorithm in security.yaml
    }

    /**
     * @see UserInterface
     */
    public function eraseCredentials()
    {
        // If you store any temporary, sensitive data on the user, clear it here
        // $this->plainPassword = null;
    }

    public function getLastSeen(): ?\DateTimeInterface
    {
        return $this->lastSeen;
    }

    public function setLastSeen(\DateTimeInterface $date): self
    {
        $this->lastSeen = $date;

        return $this;
    }

    public function getConferencesCount(): ?int
    {
        return $this->conferencesCount;
    }

    public function setConferencesCount(int $conferencesCount): self
    {
        $this->conferencesCount = $conferencesCount;

        return $this;
    }

    public function getPublicKey(): string
    {
        return $this->publicKey;
    }

    public function setPublicKey(string $publicKey): self
    {
        $this->publicKey = $publicKey;

        return $this;
    }

    public function getPrivateKey(): string
    {
        return $this->privateKey;
    }

    public function setPrivateKey(string $privateKey): self
    {
        $this->privateKey = $privateKey;

        return $this;
    }

    public function getRevocationCertificate(): string
    {
        return $this->revocationCertificate;
    }

    public function setRevocationCertificate(string $revocationCertificate): self
    {
        $this->revocationCertificate = $revocationCertificate;

        return $this;
    }
}
