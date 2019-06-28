<?php

namespace Crypter\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * @ORM\Entity(repositoryClass="Crypter\Repository\MessageRepository")
 */
class Message
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
     * @ORM\JoinColumn(name="`author`", referencedColumnName="uuid", nullable=false)
     */
    private $author;

    /**
     * @ORM\Column(type="boolean", options={"default": false})
     */
    private $readed = false;

    /**
     * @ORM\Column(type="datetimetz")
     */
    private $date;

    /**
     * @ORM\Column(type="string")
     */
    private $type;

    /**
     * @ORM\Column(type="string")
     */
    private $content;

    /**
     * @ORM\Column(type="boolean", nullable=true)
     */
    private $consumed;

    /**
     * @ORM\Column(type="boolean", nullable=true)
     */
    private $edited;

    /**
     * @ORM\OneToMany(targetEntity="Crypter\Entity\MessageReference", mappedBy="message", orphanRemoval=true)
     */
    private $messageReferences;

    public function __construct()
    {
        $this->date = (new \DateTime());
        $this->messageReferences = new ArrayCollection();
    }

    public function getUuid(): ?string
    {
        return $this->uuid;
    }

    public function getAuthor(): ?User
    {
        return $this->author;
    }

    public function setAuthor(?User $author): self
    {
        $this->author = $author;

        return $this;
    }

    public function getReaded(): ?bool
    {
        return $this->readed;
    }

    public function setReaded(bool $readed): self
    {
        $this->readed = $readed;

        return $this;
    }

    public function getDate(): ?\DateTimeInterface
    {
        return $this->date;
    }

    public function setDate(\DateTimeInterface $date): self
    {
        $this->date = $date;

        return $this;
    }

    public function getType(): ?string
    {
        return $this->type;
    }

    public function setType(string $type): self
    {
        $this->type = $type;

        return $this;
    }

    public function getContent(): ?string
    {
        return $this->content;
    }

    public function setContent(string $content): self
    {
        $this->content = $content;

        return $this;
    }

    public function getConsumed(): ?bool
    {
        return $this->consumed;
    }

    public function setConsumed(?bool $consumed): self
    {
        $this->consumed = $consumed;

        return $this;
    }

    public function getEdited(): ?bool
    {
        return $this->edited;
    }

    public function setEdited(?bool $edited): self
    {
        $this->edited = $edited;

        return $this;
    }

    /**
     * @return Collection|MessageReference[]
     */
    public function getMessageReferences(): Collection
    {
        return $this->messageReferences;
    }

    public function addMessageReference(MessageReference $messageReference): self
    {
        if (!$this->messageReferences->contains($messageReference)) {
            $this->messageReferences[] = $messageReference;
            $messageReference->setMessage($this);
        }

        return $this;
    }

    public function removeMessageReference(MessageReference $messageReference): self
    {
        if ($this->messageReferences->contains($messageReference)) {
            $this->messageReferences->removeElement($messageReference);
            // set the owning side to null (unless already changed)
            if ($messageReference->getMessage() === $this) {
                $messageReference->setMessage(null);
            }
        }

        return $this;
    }
}
