<?php
namespace Crypter\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\JsonResponse;

use Symfony\Component\Validator\Validation;
use Symfony\Component\Validator\Constraints\Uuid as UuidConstraint;

use Sensio\Bundle\FrameworkExtraBundle\Configuration\IsGranted;

use Carbon\Carbon;

use Doctrine\ORM\EntityManagerInterface;

use Crypter\Entity\User;
use Crypter\Entity\Conference;
use Crypter\Entity\ConferenceReference;
use Crypter\Entity\Participant;
use Crypter\Entity\Message;
use Crypter\Entity\MessageReference;


class MessengerController extends AbstractController
{
    private $validator;

    private $em;

    private $passwordEncoder;

    public function __construct(EntityManagerInterface $em)
    {
        $this->em = $em;
    }

    /**
     * @Route("/api/search", name="search_user")
     *
     */
    public function searchUser(Request $request): Response
    {
        $query = $request->query->get('name');

        $users = $this->em->getRepository(User::class)->search($query);

        $json = [];

        foreach ($users as $user) {
            $json[] = [
                'uuid' => $user->getUuid(),
                'name' => $user->getName(),
                'public_key' => $user->getPublicKey()
            ];
        }

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/conferences", name="get_conferences")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getConferences(Request $request): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::now();
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $conferences = $this->em->getRepository(User::class)->getConferences($user, $date, $limit);

        $json = [];

        foreach ($conferences as $key => $conference) {
            $participant = $this->em->getRepository(User::class)->find($conference['participant']);

            $json[$key] = [
                'uuid' => $conference[0]->getUuid(),
                'updated' => (float) $conference[0]->getUpdated()->format('U.u'),
                'count' => $conference['count'],
                'unread' => $conference['unread'],
                'participant' => [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ],
                'participants' => []
            ];

            $participants = $this->em->getRepository(Conference::class)->getParticipants($conference[0]);

            foreach ($participants as $participant) {
                $json[$key]['participants'][] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }
        }

        usort($json, function($a, $b) {
            return $b['updated'] - $a['updated'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/old_conferences", name="get_old_conferences")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getOldConferences(Request $request): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::now();
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $conferences = $this->em->getRepository(User::class)->getOldConferences($user, $date, $limit);

        $json = [];

        foreach ($conferences as $key => $conference) {
            $participant = $this->em->getRepository(User::class)->find($conference['participant']);

            $json[$key] = [
                'uuid' => $conference[0]->getUuid(),
                'updated' => (float) $conference[0]->getUpdated()->format('U.u'),
                'count' => $conference['count'],
                'unread' => $conference['unread'],
                'participant' => [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ],
                'participants' => []
            ];

            $participants = $this->em->getRepository(Conference::class)->getParticipants($conference[0]);

            foreach ($participants as $participant) {
                $json[$key]['participants'][] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }
        }

        usort($json, function($a, $b) {
            return $b['updated'] - $a['updated'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/new_conferences", name="get_new_conferences")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getNewConferences(Request $request): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::now();
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $conferences = $this->em->getRepository(User::class)->getNewConferences($user, $date, $limit);

        $json = [];

        foreach ($conferences as $key => $conference) {
            $participant = $this->em->getRepository(User::class)->find($conference['participant']);

            $json[$key] = [
                'uuid' => $conference[0]->getUuid(),
                'updated' => (float) $conference[0]->getUpdated()->format('U.u'),
                'count' => $conference['count'],
                'unread' => $conference['unread'],
                'participant' => [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ],
                'participants' => []
            ];

            $participants = $this->em->getRepository(Conference::class)->getParticipants($conference[0]);

            foreach ($participants as $participant) {
                $json[$key]['participants'][] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }
        }

        usort($json, function($a, $b) {
            return $b['updated'] - $a['updated'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/conference/{conference}", name="get_conference")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getConference(Request $request, $conference): Response
    {
        $user = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($conference, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $conference = $this->em->getRepository(User::class)->getConference($conference, $user);

        if (!$conference) {
            return new Response('Not Found', Response::HTTP_NOT_FOUND);
        }

        $participant = $this->em->getRepository(User::class)->find($conference['participant']);

        $json = [
            'uuid' => $conference[0]->getUuid(),
            'updated' => (float) $conference[0]->getUpdated()->format('U.u'),
            'count' => $conference['count'],
            'unread' => $conference['unread'],
            'participant' => [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ],
            'participants' => []
        ];

        $participants = $this->em->getRepository(Conference::class)->getParticipants($conference[0]);

        foreach ($participants as $participant) {
            $json['participants'][] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/conference_by_participant/{participant}", name="get_conference_by_participant")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getConferenceByParticipant(Request $request, $participant): Response
    {
        $user = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($participant, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $participant = $this->em->getRepository(User::class)->find($participant);

        if (!$participant) {
           return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conference = $this->em->getRepository(User::class)->getConferenceByParticipant($participant->getUuid(), $user);

        if (!$conference) {
            return new Response('Not Found', Response::HTTP_NOT_FOUND);
        }

        $json = [
            'uuid' => $conference[0]->getUuid(),
            'updated' => (float) $conference[0]->getUpdated()->format('U.u'),
            'count' => $conference['count'],
            'unread' => $conference['unread'],
            'participant' => [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ],
            'participants' => []
        ];

        $participants = $this->em->getRepository(Conference::class)->getParticipants($conference[0]);

        foreach ($participants as $participant) {
            $json['participants'][] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/messages", name="get_messages")
     *
     * @IsGranted("ROLE_USER")
     *
     * @TODO: Delete this unnecessary method
     */
    public function getMessages(Request $request): Response
    {
        $user = $this->getUser();

        $messages = $this->em->getRepository(User::class)->getMessages($user);

        $json = [];

        foreach ($messages as $message) {
            $author = $message->getAuthor();

            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $author->getUuid(),
                    'name' => $author->getName(),
                    'public_key' => $author->getPublicKey()
                ],
                'conference' => [
                    'uuid' => $message->getConference()->getUuid()
                ],
                'readed' => $message->getReaded(),
                'readedAt' => ($message->getReadedAt()) ? (float) $message->getReadedAt()->format('U.u') : $message->getReadedAt(),
                'date' => (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/readed_messages/", name="get_readed_messages")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getReadedMessages(Request $request): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::createFromTimestampMs(0);

        $user = $this->getUser();

        $messages = $this->em->getRepository(User::class)->getReadedMessages($user, $date);

        $json = [];

        foreach ($messages as $message) {
            $conferenceReference = $this->em->getRepository(ConferenceReference::class)->findOneBy([
                'user' => $user->getUuid(),
                'conference' => $message->getConference()->getUuid()
            ]);

            $conference = [
                'uuid' => $conferenceReference->getConference()->getUuid(),
                'updated' => $conferenceReference->getConference()->getUpdated()->format('U.u'),
                'count' => $conferenceReference->getCount(),
                'unread' => $conferenceReference->getUnread()
            ];

            if ($participant = $conferenceReference->getParticipant()) {
                $conference['participant'] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }

            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $message->getAuthor()->getUuid(),
                    'name' => $message->getAuthor()->getName(),
                    'public_key' => $message->getAuthor()->getPublicKey()
                ],
                'conference' => $conference,
                'readed' => $message->getReaded(),
                'readedAt' => ($message->getReadedAt()) ? (float) $message->getReadedAt()->format('U.u') : $message->getReadedAt(),
                'date' => (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json, function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/messages/{conference}", name="get_conference_messages")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getConferenceMessages(Request $request, $conference): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::now();
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($conference, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $conferenceReference = $this->em->getRepository(ConferenceReference::class)->findOneBy(['user' => $user->getUuid(), 'conference' => $conference]);

        if (!$conferenceReference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getMessages($conferenceReference->getConference(), $user, $date, $limit);

        $json = [];

        foreach ($messages as $message) {
            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $message->getAuthor()->getUuid(),
                    'name' => $message->getAuthor()->getName(),
                    'public_key' => $message->getAuthor()->getPublicKey()
                ],
                'conference' => [
                    'uuid' => $conferenceReference->getConference()->getUuid(),
                    'updated' => $conferenceReference->getConference()->getUpdated()->format('U.u'),
                    'count' => $conferenceReference->getCount(),
                    'unread' => $conferenceReference->getUnread(),
                    'participant' => [
                        'uuid' => $conferenceReference->getParticipant()->getUuid(),
                        'name' => $conferenceReference->getParticipant()->getName(),
                        'public_key' => $conferenceReference->getParticipant()->getPublicKey()
                    ]
                ],
                'readed' => $message->getReaded(),
                'readedAt' => ($message->getReadedAt()) ? (float) $message->getReadedAt()->format('U.u') : $message->getReadedAt(),
                'date' => (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json, function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/unread_messages/{conference}", name="get_unread_conference_messages")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getUnreadConferenceMessages(Request $request, $conference): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::createFromTimestampMs(0);
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($conference, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $conferenceReference = $this->em->getRepository(ConferenceReference::class)->findOneBy(['user' => $user->getUser(), 'conference' => $conference]);

        if (!$conferenceReference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getUnreadMessages($conferenceReference->getConference(), $user, $limit);

        $json = [];

        foreach ($messages as $message) {
            $author = $message->getAuthor();

            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $author->getUuid(),
                    'name' => $author->getName(),
                    'public_key' => $author->getPublicKey()
                ],
                'conference' => [
                    'uuid' => $conferenceReference->getConference()->getUuid(),
                    'updated' => $conferenceReference->getConference()->getUpdated()->format('U.u'),
                    'count' => $conferenceReference->getCount(),
                    'unread' => $conferenceReference->getUnread(),
                    'participant' => [
                        'uuid' => $conferenceReference->getParticipant()->getUuid(),
                        'name' => $conferenceReference->getParticipant()->getName(),
                        'public_key' => $conferenceReference->getParticipant()->getPublicKey()
                    ]
                ],
                'readed' => $message->getReaded(),
                'readedAt' => ($message->getReadedAt()) ? (float) $message->getReadedAt()->format('U.u') : $message->getReadedAt(),
                'date' => (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json, function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/old_messages/{conference}", name="get_old_conference_messages")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getOldConferenceMessages(Request $request, $conference): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::now();
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($conference, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $conferenceReference = $this->em->getRepository(ConferenceReference::class)->findOneBy(['user' => $user->getUuid(), 'conference' => $conference]);

        if (!$conferenceReference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getOldMessages($conferenceReference->getConference(), $user, $date, $limit);

        $json = [];

        foreach ($messages as $message) {
            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $message->getAuthor()->getUuid(),
                    'name' => $message->getAuthor()->getName(),
                    'public_key' => $message->getAuthor()->getPublicKey()
                ],
                'conference' => [
                    'uuid' => $conferenceReference->getConference()->getUuid(),
                    'updated' => $conferenceReference->getConference()->getUpdated()->format('U.u'),
                    'count' => $conferenceReference->getCount(),
                    'unread' => $conferenceReference->getUnread(),
                    'participant' => [
                        'uuid' => $conferenceReference->getParticipant()->getUuid(),
                        'name' => $conferenceReference->getParticipant()->getName(),
                        'public_key' => $conferenceReference->getParticipant()->getPublicKey()
                    ]
                ],
                'readed' => $message->getReaded(),
                'readedAt' => ($message->getReadedAt()) ? (float) $message->getReadedAt()->format('U.u') : $message->getReadedAt(),
                'date' =>  (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json, function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/new_messages/{conference}", name="get_new_conference_messages")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getNewConferenceMessages(Request $request, $conference): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::createFromTimestampMs(0);
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($conference, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $conferenceReference = $this->em->getRepository(ConferenceReference::class)->findOneBy(['user' => $user->getUuid(), 'conference' => $conference]);

        if (!$conferenceReference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getNewMessages($conferenceReference->getConference(), $user, $date, $limit);

        $json = [];

        foreach ($messages as $message) {
            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $message->getAuthor()->getUuid(),
                    'name' => $message->getAuthor()->getName(),
                    'public_key' => $message->getAuthor()->getPublicKey()
                ],
                'conference' => [
                    'uuid' => $conferenceReference->getConference()->getUuid(),
                    'updated' => $conferenceReference->getConference()->getUpdated()->format('U.u'),
                    'count' => $conferenceReference->getCount(),
                    'unread' => $conferenceReference->getUnread(),
                    'participant' => [
                        'uuid' => $conferenceReference->getParticipant()->getUuid(),
                        'name' => $conferenceReference->getParticipant()->getName(),
                        'public_key' => $conferenceReference->getParticipant()->getPublicKey()
                    ]
                ],
                'readed' => $message->getReaded(),
                'readedAt' => ($message->getReadedAt()) ? (float) $message->getReadedAt()->format('U.u') : $message->getReadedAt(),
                'date' =>  (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json, function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }


    /**
     * @Route("/api/messenger/messages_by_participant/{participant}", name="get_conference_messages_by_participant")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getConferenceMessagesByParticipant(Request $request, $participant): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::now();
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($participant, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $participant = $this->em->getRepository(User::class)->find($participant);

        if (!$participant) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conferenceReference = $this->em->getRepository(ConferenceReference::class)->findOneBy([
            'user' => $user->getUuid(),
            'participant' => $participant->getUuid()
        ]);

        if (!$conferenceReference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getMessages($conferenceReference->getConference(), $user, $date, $limit);

        $json = [];

        foreach ($messages as $message) {
            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $message->getAuthor()->getUuid(),
                    'name' => $message->getAuthor()->getName(),
                    'public_key' => $message->getAuthor()->getPublicKey()
                ],
                'conference' => [
                    'uuid' => $conferenceReference->getConference()->getUuid(),
                    'updated' => $conferenceReference->getConference()->getUpdated()->format('U.u'),
                    'count' => $conferenceReference->getCount(),
                    'unread' => $conferenceReference->getUnread(),
                    'participant' => [
                        'uuid' => $conferenceReference->getParticipant()->getUuid(),
                        'name' => $conferenceReference->getParticipant()->getName(),
                        'public_key' => $conferenceReference->getParticipant()->getPublicKey()
                    ]
                ],
                'readed' => $message->getReaded(),
                'readedAt' => ($message->getReadedAt()) ? (float) $message->getReadedAt()->format('U.u') : $message->getReadedAt(),
                'date' => (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json, function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/unread_messages_by_participant/{participant}", name="get_unread_conference_messages_by_participant")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getUnreadConferenceMessagesByParticipant(Request $request, $participant): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::createFromTimestampMs(0);
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($participant, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $participant = $this->em->getRepository(User::class)->find($participant);

        if (!$participant) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conferenceReference = $this->em->getRepository(ConferenceReference::class)->findOneBy(['user' => $user->getUuid(), 'participant' => $participant->getUuid()]);

        if (!$conferenceReference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getUnreadMessages($conferenceReference->getConference(), $user, $date, $limit);

        $json = [];

        foreach ($messages as $message) {
            $author = $message->getAuthor();

            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $author->getUuid(),
                    'name' => $author->getName(),
                    'public_key' => $author->getPublicKey()
                ],
                'conference' => [
                    'uuid' => $conferenceReference->getConference()->getUuid(),
                    'updated' => $conferenceReference->getConference()->getUpdated()->format('U.u'),
                    'count' => $conferenceReference->getCount(),
                    'unread' => $conferenceReference->getUnread(),
                    'participant' => [
                        'uuid' => $conferenceReference->getParticipant()->getUuid(),
                        'name' => $conferenceReference->getParticipant()->getName(),
                        'public_key' => $conferenceReference->getParticipant()->getPublicKey()
                    ]
                ],
                'readed' => $message->getReaded(),
                'readedAt' => ($message->getReadedAt()) ? (float) $message->getReadedAt()->format('U.u') : $message->getReadedAt(),
                'date' => (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json, function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/old_messages_by_participant/{participant}", name="get_old_conference_messages_by_participant")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getOldConferenceMessagesByParticipant(Request $request, $participant): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::now();
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($participant, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $participant = $this->em->getRepository(User::class)->find($participant);

        if (!$participant) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conferenceReference = $this->em->getRepository(ConferenceReference::class)->findOneBy(['user' => $user->getUuid(), 'participant' => $participant->getUuid()]);

        if (!$conferenceReference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getOldMessages($conferenceReference->getConference(), $user, $date, $limit);

        $json = [];

        foreach ($messages as $message) {
            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $message->getAuthor()->getUuid(),
                    'name' => $message->getAuthor()->getName(),
                    'public_key' => $message->getAuthor()->getPublicKey()
                ],
                'conference' => [
                    'uuid' => $conferenceReference->getConference()->getUuid(),
                    'updated' => $conferenceReference->getConference()->getUpdated()->format('U.u'),
                    'count' => $conferenceReference->getCount(),
                    'unread' => $conferenceReference->getUnread(),
                    'participant' => [
                        'uuid' => $conferenceReference->getParticipant()->getUuid(),
                        'name' => $conferenceReference->getParticipant()->getName(),
                        'public_key' => $conferenceReference->getParticipant()->getPublicKey()
                    ]
                ],
                'readed' => $message->getReaded(),
                'readedAt' => ($message->getReadedAt()) ? (float) $message->getReadedAt()->format('U.u') : $message->getReadedAt(),
                'date' =>  (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json, function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/new_messages_by_participant/{participant}", name="get_new_conference_messages_by_participant")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getNewConferenceMessagesByParticipant(Request $request, $participant): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::createFromTimestampMs(0);
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($participant, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $participant = $this->em->getRepository(User::class)->find($participant);

        if (!$participant) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conferenceReference = $this->em->getRepository(ConferenceReference::class)->findOneBy(['user' => $user->getUuid(), 'participant' => $participant->getUuid()]);

        if (!$conferenceReference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getNewMessages($conferenceReference->getConference(), $user, $date, $limit);

        $json = [];

        foreach ($messages as $message) {
            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $message->getAuthor()->getUuid(),
                    'name' => $message->getAuthor()->getName(),
                    'public_key' => $message->getAuthor()->getPublicKey()
                ],
                'conference' => [
                    'uuid' => $conferenceReference->getConference()->getUuid(),
                    'updated' => $conferenceReference->getConference()->getUpdated()->format('U.u'),
                    'count' => $conferenceReference->getCount(),
                    'unread' => $conferenceReference->getUnread(),
                    'participant' => [
                        'uuid' => $conferenceReference->getParticipant()->getUuid(),
                        'name' => $conferenceReference->getParticipant()->getName(),
                        'public_key' => $conferenceReference->getParticipant()->getPublicKey()
                    ]
                ],
                'readed' => $message->getReaded(),
                'readedAt' => ($message->getReadedAt()) ? (float) $message->getReadedAt()->format('U.u') : $message->getReadedAt(),
                'date' =>  (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json, function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/sync/", name="get_updates")
     *
     * @IsGranted("ROLE_USER")
     */
    public function synchronize(Request $request): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $minDate = ($request->query->has('min_timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('min_timestamp') * 1000) : Carbon::createFromTimestampMs(0);
        $maxDate = ($request->query->has('max_timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('max_timestamp') * 1000) : Carbon::now();

        $user = $this->getUser();

        $conferences = $this->em->getRepository(User::class)->getUpdatedConferences($user, $maxDate);
        $messages = $this->em->getRepository(User::class)->getUpdatedMessages($user, $maxDate);
        $readMessages = $this->em->getRepository(User::class)->getReadedMessages($user, $maxDate);
        $unreadMessages = $this->em->getRepository(User::class)->getUnreadMessages($user, $minDate);

        $json = [
            'conferences' => [],
            'messages' => [],
            'read_messages' => [],
            'unread_messages' => []
        ];

        foreach ($conferences as $conference) {
            $participant = $this->em->getRepository(User::class)->find($conference['participant']);

            $json['conferences'][] = [
                'uuid' => $conference[0]->getUuid(),
                'updated' => (float) $conference[0]->getUpdated()->format('U.u'),
                'count' => $conference['count'],
                'unread' => $conference['unread'],
                'participant' => [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ],
                'participants' => []
            ];
        }

        usort($json['conferences'], function($a, $b) {
            return $b['updated'] - $a['updated'];
        });

        foreach ($messages as $message) {
            $conferenceReference = $this->em->getRepository(ConferenceReference::class)->findOneBy([
                'user' => $user->getUuid(),
                'conference' => $message->getConference()->getUuid()
            ]);

            $conference = [
                'uuid' => $conferenceReference->getConference()->getUuid(),
                'updated' => $conferenceReference->getConference()->getUpdated()->format('U.u'),
                'count' => $conferenceReference->getCount(),
                'unread' => $conferenceReference->getUnread()
            ];

            if ($participant = $conferenceReference->getParticipant()) {
                $conference['participant'] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }

            $json['messages'][] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $message->getAuthor()->getUuid(),
                    'name' => $message->getAuthor()->getName(),
                    'public_key' => $message->getAuthor()->getPublicKey()
                ],
                'conference' => $conference,
                'readed' => $message->getReaded(),
                'readedAt' => ($message->getReadedAt()) ? (float) $message->getReadedAt()->format('U.u') : $message->getReadedAt(),
                'date' => (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json['messages'], function($a, $b) {
            return $a['date'] - $b['date'];
        });

        foreach ($readMessages as $message) {
            $conferenceReference = $this->em->getRepository(ConferenceReference::class)->findOneBy([
                'user' => $user->getUuid(),
                'conference' => $message->getConference()->getUuid()
            ]);

            $conference = [
                'uuid' => $conferenceReference->getConference()->getUuid(),
                'updated' => $conferenceReference->getConference()->getUpdated()->format('U.u'),
                'count' => $conferenceReference->getCount(),
                'unread' => $conferenceReference->getUnread()
            ];

            if ($participant = $conferenceReference->getParticipant()) {
                $conference['participant'] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }

            $json['read_messages'][] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $message->getAuthor()->getUuid(),
                    'name' => $message->getAuthor()->getName(),
                    'public_key' => $message->getAuthor()->getPublicKey()
                ],
                'conference' => $conference,
                'readed' => $message->getReaded(),
                'readedAt' => ($message->getReadedAt()) ? (float) $message->getReadedAt()->format('U.u') : $message->getReadedAt(),
                'date' => (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json['read_messages'], function($a, $b) {
            return $a['date'] - $b['date'];
        });

        foreach ($unreadMessages as $message) {
            $conferenceReference = $this->em->getRepository(ConferenceReference::class)->findOneBy([
                'user' => $user->getUuid(),
                'conference' => $message->getConference()->getUuid()
            ]);

            $conference = [
                'uuid' => $conferenceReference->getConference()->getUuid(),
                'updated' => $conferenceReference->getConference()->getUpdated()->format('U.u'),
                'count' => $conferenceReference->getCount(),
                'unread' => $conferenceReference->getUnread()
            ];

            if ($participant = $conferenceReference->getParticipant()) {
                $conference['participant'] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }

            $json['unread_messages'][] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $message->getAuthor()->getUuid(),
                    'name' => $message->getAuthor()->getName(),
                    'public_key' => $message->getAuthor()->getPublicKey()
                ],
                'conference' => $conference,
                'readed' => $message->getReaded(),
                'readedAt' => ($message->getReadedAt()) ? (float) $message->getReadedAt()->format('U.u') : $message->getReadedAt(),
                'date' => (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json['unread_messages'], function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/message/{user}", methods={"POST"}, name="send_message")
     *
     * @IsGranted("ROLE_USER")
     */
    public function sendMessage(Request $request, $user): Response
    {
        // x-www-urlencoded or json
        $data = empty($request->request->all()) ? json_decode($request->getContent(), $assoc = true) : $request->request->all();

        $sender = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($user, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $reciever = $this->em->find(User::class, $user);

        if (!$reciever) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conference = $this->em->getRepository(Conference::class)->getConferenceByParticipant($sender, $reciever);

        if (!$conference) {
            $conference = new Conference();
            $this->em->persist($conference);

            $senderConferenceReference = new ConferenceReference();
            $senderConferenceReference->setUser($sender);
            $senderConferenceReference->setConference($conference);
            $senderConferenceReference->setParticipant($reciever);
            $this->em->persist($senderConferenceReference);

            $receiverConferenceReference = new ConferenceReference();
            $receiverConferenceReference->setUser($reciever);
            $receiverConferenceReference->setConference($conference);
            $receiverConferenceReference->setParticipant($sender);
            $this->em->persist($receiverConferenceReference);

            $senderParticipant = new Participant();
            $senderParticipant->setConference($conference);
            $senderParticipant->setUser($sender);
            $this->em->persist($senderParticipant);

            $receiverParticipant = new Participant();
            $receiverParticipant->setConference($conference);
            $receiverParticipant->setUser($reciever);
            $this->em->persist($receiverParticipant);
        }


        $senderConferenceReference =  $senderConferenceReference ?? $this->em->getRepository(ConferenceReference::class)->findOneBy(['user' => $sender->getUuid(), 'conference' => $conference->getUuid()]);

        if (!$senderConferenceReference) {
            $senderConferenceReference = new ConferenceReference();
            $senderConferenceReference->setUser($sender);
            $senderConferenceReference->setConference($conference);
            $senderConferenceReference->setParticipant($reciever);
            $this->em->persist($senderConferenceReference);
        }


        $receiverConferenceReference = $receiverConferenceReference ?? $this->em->getRepository(ConferenceReference::class)->findOneBy(['user' => $reciever->getUuid(), 'conference' => $conference->getUuid()]);

        if (!$receiverConferenceReference) {
            $receiverConferenceReference = new ConferenceReference();
            $receiverConferenceReference->setUser($reciever);
            $receiverConferenceReference->setConference($conference);
            $receiverConferenceReference->setParticipant($sender);
            $this->em->persist($receiverConferenceReference);
        }


        $message = new Message();
        $message->setConference($conference);
        $message->setAuthor($sender);
        $message->setType('text/plain');
        $message->setContent($data['text']);
        $message->setEdited(false);
        $this->em->persist($message);

        $senderMessageReference = new MessageReference();
        $senderMessageReference->setUser($sender);
        $senderMessageReference->setMessage($message);
        $this->em->persist($senderMessageReference);
        
        $receiverMessageReference = new MessageReference();
        $receiverMessageReference->setUser($reciever);
        $receiverMessageReference->setMessage($message);
        $this->em->persist($receiverMessageReference);


        $conference->setUpdated((new \DateTime()));
        $this->em->persist($conference);

        $senderConferenceReference->setCount($senderConferenceReference->getCount() + 1);
        $this->em->persist($senderConferenceReference);

        $receiverConferenceReference->setCount($receiverConferenceReference->getCount() + 1);
        $receiverConferenceReference->setUnread($receiverConferenceReference->getUnread() + 1);
        $this->em->persist($receiverConferenceReference);


        $this->em->flush();

        $json = [
            'data' => [
                'to' => $user,
                'text' => $data['text']
            ],
            'conference' => [
                'uuid' => $conference->getUuid(),
                'updated' => $conference->getUpdated(),
                'participants' => [
                    [
                        'uuid' => $sender->getUuid(),
                        'name' => $sender->getName(),
                        'public_Key' => $sender->getPublicKey()
                    ],
                    [
                        'uuid' => $reciever->getUuid(),
                        'name' => $reciever->getName(),
                        'public_key' => $reciever->getPublicKey()
                    ]
                ]
            ],
            'conference_references' => [
                [
                    'uuid' => $senderConferenceReference->getUuid(),
                    'conference' => $senderConferenceReference->getConference()->getUuid(),
                    'count' => $senderConferenceReference->getCount(),
                    'unread' => $senderConferenceReference->getUnread()
                ],
                [
                    'uuid' => $receiverConferenceReference->getUuid(),
                    'conference' => $receiverConferenceReference->getConference()->getUuid(),
                    'count' => $receiverConferenceReference->getCount(),
                    'unread' => $receiverConferenceReference->getUnread()
                ]
            ],
            'message' => [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $message->getAuthor()->getUuid(),
                    'name' => $message->getAuthor()->getName(),
                    'public_key' => $message->getAuthor()->getPublicKey()
                ],
                'readed' => $message->getReaded(),
                'readedAt' => ($message->getReadedAt()) ? (float) $message->getReadedAt()->format('U.u') : $message->getReadedAt(),
                'date' => $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ]
        ];

        return new JsonResponse($json);
    }
}
